import { db, collection, getDocs, query, where } from './firebase';
import { collections } from './collections';

// ─── Constants ────────────────────────────────────────────────────────────────

export const EXAM_ELIGIBILITY_THRESHOLD = 80;

export const XP_REWARDS = {
  CHECKIN: 10,
  ON_TIME_BONUS: 5,
  ABSENCE_PENALTY: -3,
  FEEDBACK_BONUS: 20,
  PERFECT_WEEK_BONUS: 50,
} as const;

export const STREAK_MULTIPLIERS = [
  { days: 14, multiplier: 3.0 },
  { days: 7, multiplier: 2.0 },
  { days: 3, multiplier: 1.5 },
  { days: 0, multiplier: 1.0 },
] as const;

export const LEVELS = [
  { level: 1, name: 'Freshman', xpRequired: 0 },
  { level: 2, name: 'Sophomore', xpRequired: 100 },
  { level: 3, name: 'Junior', xpRequired: 300 },
  { level: 4, name: 'Senior', xpRequired: 600 },
  { level: 5, name: 'Scholar', xpRequired: 1000 },
  { level: 6, name: "Dean's List", xpRequired: 1600 },
  { level: 7, name: 'Honors', xpRequired: 2500 },
  { level: 8, name: "Chancellor's Circle", xpRequired: 4000 },
  { level: 9, name: 'Legend', xpRequired: 6000 },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
  progress?: number;
  maxProgress?: number;
}

export interface LevelInfo {
  level: number;
  name: string;
  xpRequired: number;
  xpCurrent: number;
  xpForNext: number;
  progress: number;
}

export interface RankTier {
  id: string;
  name: string;
  icon: string;
  xpRequired: number;
  color: string;
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  studentName: string;
  xp: number;
  attendanceRate: number;
  isCurrentUser: boolean;
}

export interface WeeklyChallenge {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  progress: number;
  target: number;
  completed: boolean;
  icon: string;
}

export interface CourseEligibility {
  courseCode: string;
  courseName: string;
  attendanceRate: number;
  eligible: boolean;
  sessionsAttended: number;
  totalSessions: number;
  sessionsNeeded: number;
}

export interface GamificationData {
  totalXp: number;
  level: LevelInfo;
  badges: Badge[];
  rank: RankTier;
  streak: { current: number; longest: number };
  weeklyChallenges: WeeklyChallenge[];
  leaderboard: LeaderboardEntry[];
  courseEligibility: CourseEligibility[];
  overallEligibility: boolean;
}

// ─── Level System ─────────────────────────────────────────────────────────────

export function computeLevel(totalXp: number): LevelInfo {
  let currentLevel = LEVELS[0];
  let nextLevel = LEVELS[1];

  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVELS[i].xpRequired) {
      currentLevel = LEVELS[i];
      nextLevel = LEVELS[i + 1] || LEVELS[i];
      break;
    }
  }

  const xpInLevel = totalXp - currentLevel.xpRequired;
  const xpRange = nextLevel.xpRequired - currentLevel.xpRequired;
  const progress = xpRange > 0 ? Math.min(100, Math.round((xpInLevel / xpRange) * 100)) : 100;

  return {
    level: currentLevel.level,
    name: currentLevel.name,
    xpRequired: currentLevel.xpRequired,
    xpCurrent: totalXp,
    xpForNext: nextLevel.xpRequired,
    progress,
  };
}

// ─── Rank Tiers ───────────────────────────────────────────────────────────────

export const RANK_TIERS: RankTier[] = [
  { id: 'bronze', name: 'Bronze', icon: '🥉', xpRequired: 0, color: '#CD7F32' },
  { id: 'silver', name: 'Silver', icon: '🥈', xpRequired: 500, color: '#C0C0C0' },
  { id: 'gold', name: 'Gold', icon: '🥇', xpRequired: 1500, color: '#FFD700' },
  { id: 'diamond', name: 'Diamond', icon: '💎', xpRequired: 3000, color: '#B9F2FF' },
];

export function computeRank(totalXp: number): RankTier {
  let rank = RANK_TIERS[0];
  for (const tier of RANK_TIERS) {
    if (totalXp >= tier.xpRequired) rank = tier;
  }
  return rank;
}

// ─── XP Computation ───────────────────────────────────────────────────────────

export function computeTotalXp(
  attendanceList: any[],
  allSessions: any[],
  feedbackCount: number,
  streakDays: number
): number {
  let xp = 0;

  // XP from attendance
  for (const att of attendanceList) {
    const status = att.status || 'present';
    if (status === 'present') {
      xp += XP_REWARDS.CHECKIN;
      // On-time bonus: check if timestamp is within first 2 minutes of session start
      const session = allSessions.find(s => s.id === att.sessionId);
      if (session && att.timestamp && session.startTime) {
        try {
          const checkinTime = att.timestamp?.toDate ? att.timestamp.toDate() : new Date(att.timestamp);
          const [hours, mins] = session.startTime.split(':').map(Number);
          const sessionStart = new Date(checkinTime);
          sessionStart.setHours(hours, mins, 0, 0);
          const diffMinutes = (checkinTime.getTime() - sessionStart.getTime()) / 60000;
          if (diffMinutes <= 2) xp += XP_REWARDS.ON_TIME_BONUS;
        } catch { /* skip */ }
      }
    } else if (status === 'late') {
      xp += XP_REWARDS.CHECKIN; // half credit essentially
    } else if (status === 'absent') {
      xp += XP_REWARDS.ABSENCE_PENALTY;
    }
  }

  // Streak multiplier
  const streakMultiplier = STREAK_MULTIPLIERS.find(m => streakDays >= m.days)?.multiplier || 1.0;
  if (streakMultiplier > 1) {
    xp = Math.round(xp * streakMultiplier);
  }

  // Feedback bonus
  xp += feedbackCount * XP_REWARDS.FEEDBACK_BONUS;

  return Math.max(0, xp);
}

// ─── Badge Definitions ────────────────────────────────────────────────────────

export function computeBadges(
  attendanceList: any[],
  allSessions: any[],
  feedbackCount: number,
  streakCurrent: number,
  streakLongest: number,
  courseRates: Map<string, number>
): Badge[] {
  const totalCheckins = attendanceList.filter(a => a.status === 'present' || a.status === 'late').length;
  const uniqueDates = new Set(attendanceList.filter(a => a.date).map(a => a.date));

  // Perfect week check (counts all sessions present/late this week, regardless of session close status)
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  const weekSessions = allSessions.filter(s => {
    if (!s.date) return false;
    const d = new Date(s.date);
    return d >= weekStart && d <= weekEnd;
  });
  const weekAttended = weekSessions.filter(s => {
    attendanceList.some(a => a.sessionId === s.id && (a.status === 'present' || a.status === 'late'))
  }).length;
  const perfectWeek = weekSessions.length > 0 && weekAttended === weekSessions.length;

  // Early bird: check if any check-in was within first 2 minutes
  let earlyBird = false;
  for (const att of attendanceList) {
    if (att.status !== 'present') continue;
    const session = allSessions.find(s => s.id === att.sessionId);
    if (session && att.timestamp && session.startTime) {
      try {
        const checkinTime = att.timestamp?.toDate ? att.timestamp.toDate() : new Date(att.timestamp);
        const [hours, mins] = session.startTime.split(':').map(Number);
        const sessionStart = new Date(checkinTime);
        sessionStart.setHours(hours, mins, 0, 0);
        const diffMinutes = (checkinTime.getTime() - sessionStart.getTime()) / 60000;
        if (diffMinutes <= 2) { earlyBird = true; break; }
      } catch { /* skip */ }
    }
  }

  // Course mastery: any course at 100%
  let courseMastery = false;
  courseRates.forEach(rate => { if (rate === 100) courseMastery = true; });

  return [
    {
      id: 'first_step',
      name: 'First Step',
      description: 'Complete your first check-in',
      icon: 'footprints',
      unlocked: totalCheckins >= 1,
      progress: Math.min(1, totalCheckins),
      maxProgress: 1,
    },
    {
      id: 'perfect_week',
      name: 'Perfect Week',
      description: 'Attend all classes in a week',
      icon: 'calendar-check',
      unlocked: perfectWeek,
      progress: weekSessions.length > 0 ? weekAttended : 0,
      maxProgress: weekSessions.length || 1,
    },
    {
      id: 'iron_streak',
      name: 'Iron Streak',
      description: 'Maintain a 7-day attendance streak',
      icon: 'flame',
        unlocked: streakCurrent >= 7,
        progress: Math.min(7, streakCurrent),
        maxProgress: 7,
    },
    {
      id: 'unstoppable',
      name: 'Unstoppable',
      description: 'Maintain a 14-day attendance streak',
      icon: 'zap',
        unlocked: streakCurrent >= 14,
        progress: Math.min(14, streakCurrent),
        maxProgress: 14,
    },
    {
      id: 'early_bird',
      name: 'Early Bird',
      description: 'Check in within the first 2 minutes',
      icon: 'sunrise',
      unlocked: earlyBird,
      progress: earlyBird ? 1 : 0,
      maxProgress: 1,
    },
    {
      id: 'course_mastery',
      name: 'Course Mastery',
      description: 'Achieve 100% attendance in any course',
      icon: 'award',
      unlocked: courseMastery,
      progress: courseMastery ? 1 : 0,
      maxProgress: 1,
    },
    {
      id: 'social_butterfly',
      name: 'Social Butterfly',
      description: 'Submit feedback for 5 sessions',
      icon: 'message-circle',
      unlocked: feedbackCount >= 5,
      progress: Math.min(5, feedbackCount),
      maxProgress: 5,
    },
    {
      id: 'centurion',
      name: 'Centurion',
      description: 'Attend 100 classes',
      icon: 'shield',
      unlocked: totalCheckins >= 100,
      progress: Math.min(100, totalCheckins),
      maxProgress: 100,
    },
  ];
}

// ─── Weekly Challenges ────────────────────────────────────────────────────────

export function computeWeeklyChallenges(
  attendanceList: any[],
  allSessions: any[],
  feedbackCount: number
): WeeklyChallenge[] {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const weekSessions = allSessions.filter(s => {
    if (!s.date) return false;
    const d = new Date(s.date);
    return d >= weekStart && d <= weekEnd;
  });

  const weekAttended = weekSessions.filter(s =>
    attendanceList.some(a => a.sessionId === s.id && (a.status === 'present' || a.status === 'late'))
  ).length;

  // Early check-ins this week (before 8AM)
  let earlyCheckins = 0;
  for (const att of attendanceList) {
    if (att.status === 'absent' || !att.date) continue;
    const attDate = new Date(att.date);
    if (attDate < weekStart || attDate > weekEnd) continue;
    const session = allSessions.find(s => s.id === att.sessionId);
    if (session?.startTime) {
      const hour = parseInt(session.startTime.split(':')[0], 10);
      if (hour < 8) earlyCheckins++;
    }
  }

  // Feedback submitted this week
  const weekFeedbackCount = feedbackCount; // approximate

  // Compute weekly streak: consecutive days with present/late attendance in this week
  const weekAttendedDates = [...new Set(
    attendanceList
      .filter(a => a.date && a.status !== 'absent')
      .map(a => a.date as string)
      .filter(d => {
        const dd = new Date(d);
        return dd >= weekStart && dd <= weekEnd;
      })
  )].sort().reverse();

  let weeklyStreak = 0;
  if (weekAttendedDates.length > 0) {
    weeklyStreak = 1;
    for (let i = 1; i < weekAttendedDates.length; i++) {
      const prev = new Date(weekAttendedDates[i - 1]);
      const curr = new Date(weekAttendedDates[i]);
      const diffDays = (prev.getTime() - curr.getTime()) / 86400000;
      if (diffDays === 1) weeklyStreak++;
      else break;
    }
  }

  return [
    {
      id: 'attend_all',
      title: 'Attend Every Class',
      description: `Attend all ${weekSessions.length} classes this week`,
      xpReward: XP_REWARDS.PERFECT_WEEK_BONUS,
      progress: weekAttended,
      target: weekSessions.length || 1,
      completed: weekSessions.length > 0 && weekAttended >= weekSessions.length,
      icon: 'calendar-check',
    },
    {
      id: 'early_bird_week',
      title: 'Early Bird',
      description: 'Check in before 8AM twice this week',
      xpReward: 30,
      progress: earlyCheckins,
      target: 2,
      completed: earlyCheckins >= 2,
      icon: 'sunrise',
    },
    {
      id: 'feedback_week',
      title: 'Give Feedback',
      description: 'Submit feedback for a session',
      xpReward: XP_REWARDS.FEEDBACK_BONUS,
      progress: Math.min(1, weekFeedbackCount),
      target: 1,
      completed: weekFeedbackCount >= 1,
      icon: 'message-circle',
    },
    {
      id: 'streak_week',
      title: 'Build a Streak',
      description: 'Attend 3 days in a row',
      xpReward: 40,
      progress: weeklyStreak,
      target: 3,
      completed: weeklyStreak >= 3,
      icon: 'flame',
    },
  ];
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export async function computeLeaderboard(
  courseCode: string,
  currentUserId: string,
  allSessions: any[]
): Promise<LeaderboardEntry[]> {
  const courseSessions = allSessions.filter(s => s.courseCode === courseCode);
  const studentMap = new Map<string, { name: string; attended: number; total: number }>();

  for (const session of courseSessions) {
    try {
      const attSnap = await getDocs(collection(db, `${collections.SESSIONS}/${session.id}/attendance`));
      attSnap.forEach(doc => {
        const data = doc.data();
        const sid = data.studentId;
        if (!sid) return;
        const existing = studentMap.get(sid) || { name: data.studentName || sid, attended: 0, total: 0 };
        existing.total++;
        if (data.status === 'present' || data.status === 'late') existing.attended++;
        studentMap.set(sid, existing);
      });

      // Count enrolled students who didn't attend
      const enrolledQ = query(collection(db, collections.ENROLLMENTS), where('courseCode', '==', courseCode));
      const enrolledSnap = await getDocs(enrolledQ);
      enrolledSnap.forEach(doc => {
        const data = doc.data();
        const sid = data.studentId;
        if (!sid) return;
        const existing = studentMap.get(sid) || { name: data.studentName || sid, attended: 0, total: 0 };
        if (existing.total === 0) {
          existing.total = courseSessions.length;
          studentMap.set(sid, existing);
        }
      });
    } catch { /* skip */ }
  }

  const entries: LeaderboardEntry[] = [];
  studentMap.forEach((value, sid) => {
    const rate = value.total > 0 ? Math.round((value.attended / value.total) * 100) : 0;
    // XP estimate based on attendance
    const xp = value.attended * XP_REWARDS.CHECKIN;
    entries.push({
      rank: 0,
      studentId: sid,
      studentName: value.name,
      xp,
      attendanceRate: rate,
      isCurrentUser: sid === currentUserId,
    });
  });

  entries.sort((a, b) => b.attendanceRate - a.attendanceRate || b.xp - a.xp);
  entries.forEach((e, i) => { e.rank = i + 1; });

  return entries;
}

// ─── Course Eligibility ───────────────────────────────────────────────────────

export function computeCourseEligibility(
  courseCodes: string[],
  allSessions: any[],
  attendanceList: any[],
  courses: any[]
): CourseEligibility[] {
  const result: CourseEligibility[] = [];

  for (const code of courseCodes) {
    const courseSessions = allSessions.filter(s => s.courseCode === code);
    const totalSessions = courseSessions.length;
    if (totalSessions === 0) continue;

    const courseAtt = attendanceList.filter(a => a.courseCode === code);
    const attended = courseAtt.filter(a => a.status === 'present' || a.status === 'late').length;
    const rate = Math.round((attended / totalSessions) * 100);
    const eligible = rate >= EXAM_ELIGIBILITY_THRESHOLD;

    // Sessions needed to reach 80%
    let sessionsNeeded = 0;
    if (!eligible && totalSessions > 0) {
      // x = sessions needed, (attended + x) / (totalSessions + x) >= 0.8
      // attended + x >= 0.8 * totalSessions + 0.8x
      // 0.2x >= 0.8 * totalSessions - attended
      // x >= (0.8 * totalSessions - attended) / 0.2
      const needed = Math.ceil((0.8 * totalSessions - attended) / 0.2);
      sessionsNeeded = Math.max(0, needed);
    }

    const course = courses.find((c: any) => c.code === code);
    result.push({
      courseCode: code,
      courseName: course?.name || code,
      attendanceRate: rate,
      eligible,
      sessionsAttended: attended,
      totalSessions,
      sessionsNeeded,
    });
  }

  return result.sort((a, b) => a.attendanceRate - b.attendanceRate);
}

// ─── Streak Computation ───────────────────────────────────────────────────────

export function computeStreak(attendanceList: any[]): { current: number; longest: number } {
  const presentDates: string[] = attendanceList
    .filter((a: any) => a.date && a.status !== 'absent')
    .map((a: any) => a.date as string);

  if (presentDates.length === 0) return { current: 0, longest: 0 };

  const unique = [...new Set(presentDates)].sort().reverse() as string[];
  
  let current = 0;
  if (unique.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const first = new Date(unique[0]);
    first.setHours(0, 0, 0, 0);
    const diffFromToday = (today.getTime() - first.getTime()) / 86400000;
    if (diffFromToday <= 1) {
      current = 1;
      for (let i = 1; i < unique.length; i++) {
        const prev = new Date(unique[i - 1]);
        const curr = new Date(unique[i]);
        prev.setHours(0, 0, 0, 0);
        curr.setHours(0, 0, 0, 0);
        const diffDays = (prev.getTime() - curr.getTime()) / 86400000;
        if (diffDays === 1) current++;
        else break;
      }
    }
  }

  const sortedAsc = [...unique].sort();
  let longest = 1;
  let streak = 1;
  for (let i = 1; i < sortedAsc.length; i++) {
    const prev = new Date(sortedAsc[i - 1]);
    const curr = new Date(sortedAsc[i]);
    const diffDays = (curr.getTime() - prev.getTime()) / 86400000;
    if (diffDays === 1) {
      streak++;
      longest = Math.max(longest, streak);
    } else {
      streak = 1;
    }
  }

  return { current, longest };
}

// ─── Full Gamification Data ───────────────────────────────────────────────────

export function computeGamificationData(
  attendanceList: any[],
  allSessions: any[],
  courseCodes: string[],
  courses: any[],
  feedbackCount: number,
  currentUserId: string
): GamificationData {
  const streak = computeStreak(attendanceList);

  const totalXp = computeTotalXp(attendanceList, allSessions, feedbackCount, streak.current);
  const level = computeLevel(totalXp);
  const rank = computeRank(totalXp);

  // Per-course rates for badge computation
  const courseRates = new Map<string, number>();
  for (const code of courseCodes) {
    const courseSessions = allSessions.filter(s => s.courseCode === code);
    const courseAtt = attendanceList.filter(a => a.courseCode === code);
    const attended = courseAtt.filter(a => a.status !== 'absent').length;
    const rate = courseSessions.length > 0 ? Math.round((attended / courseSessions.length) * 100) : 0;
    courseRates.set(code, rate);
  }

  const badges = computeBadges(attendanceList, allSessions, feedbackCount, streak.current, streak.longest, courseRates);
  const weeklyChallenges = computeWeeklyChallenges(attendanceList, allSessions, feedbackCount);
  const courseEligibility = computeCourseEligibility(courseCodes, allSessions, attendanceList, courses);
  const overallEligibility = courseEligibility.every(c => c.eligible) || courseEligibility.length === 0;

  return {
    totalXp,
    level,
    badges,
    rank,
    streak,
    weeklyChallenges,
    leaderboard: [], // populated async by component
    courseEligibility,
    overallEligibility,
  };
}

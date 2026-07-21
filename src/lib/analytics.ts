import { db, collection, getDocs } from './firebase';
import { collections } from './collections';

// ─── Core Data Types ──────────────────────────────────────────────────────────

export interface SessionRecord {
  id: string;
  courseCode: string;
  courseName: string;
  lecturerId: string;
  lecturerName: string;
  date: string;
  startTime: string;
  endTime: string;
  startedAt?: any;
  endedAt?: any;
  enrolledCount: number;
  status: string;
  room?: string;
  topicOfDay?: string;
  attendanceCount?: number;
  mode?: 'physical' | 'online' | 'hybrid';
}

export interface AttendanceRecord {
  studentId: string;
  studentName: string;
  timestamp: any;
  status: string;
  deviceFingerprint?: string;
  studentEmail?: string;
}

export interface UserRecord {
  uid: string;
  name: string;
  role: string;
  department?: string;
  email?: string;
  schoolCode?: string;
  intake?: string;
  deviceFingerprint?: string | null;
}

export interface FeedbackRecord {
  id: string;
  rating: number;
  comment: string;
  courseCode: string;
  courseName: string;
  lecturerId: string;
  lecturerName: string;
  studentId: string;
  studentName?: string;
  createdAt: any;
}

export interface EnrollmentRecord {
  courseCode: string;
  studentId: string;
  studentName: string;
  program?: string;
  enrolledAt?: any;
}

export interface CourseRecord {
  code: string;
  name: string;
  department?: string;
  school?: string;
  mode?: 'physical' | 'online' | 'hybrid';
  lecturer?: string;
}

// ─── Analytics Output Types ───────────────────────────────────────────────────

export interface LecturerEffectiveness {
  lecturerId: string;
  name: string;
  department: string;
  sessionCount: number;
  avgAttendanceRate: number;
  avgFeedbackScore: number;
  totalStudents: number;
  trend: number;
}

export interface TimeHeatmapCell {
  day: number;
  hour: number;
  count: number;
  avgRate: number;
}

export interface PredictiveRisk {
  studentId: string;
  name: string;
  courseCode: string;
  courseName: string;
  currentRate: number;
  projectedRate: number;
  riskLevel: 'high' | 'medium' | 'low';
  sessionsToThreshold: number;
}

export interface DepartmentStats {
  department: string;
  totalStudents: number;
  totalSessions: number;
  avgAttendanceRate: number;
  courseCount: number;
}

export interface FeedbackCorrelation {
  courseCode: string;
  courseName: string;
  avgAttendance: number;
  avgFeedback: number;
  sessionCount: number;
}

export interface GeoCompliance {
  totalCheckins: number;
  gpsCheckins: number;
  ipCheckins: number;
  gpsComplianceRate: number;
  ipComplianceRate: number;
}

export interface CohortAnalytics {
  program: string;
  avgAttendanceRate: number;
  studentCount: number;
  sessionCount: number;
}

export interface OperationalMetrics {
  totalSessions: number;
  avgSessionDurationMinutes: number;
  peakDay: string;
  peakHour: number;
  sessionsPerWeek: { week: string; count: number }[];
  closedSessions: number;
  openSessions: number;
}

export interface Anomaly {
  type: 'zero_attendance' | 'sudden_drop' | 'high_late' | 'device_reuse' | 'perfect_session';
  description: string;
  severity: 'high' | 'medium' | 'low';
  studentId?: string;
  studentName?: string;
  courseCode?: string;
  date?: string;
  details?: string;
}

export interface GoalProgress {
  target: number;
  current: number;
  percentage: number;
  trend: 'improving' | 'declining' | 'stable';
}

// ─── Raw Fetched Data ─────────────────────────────────────────────────────────

export interface AllAnalyticsData {
  sessions: SessionRecord[];
  attendanceMap: Map<string, AttendanceRecord[]>;
  users: UserRecord[];
  courses: CourseRecord[];
  enrollments: EnrollmentRecord[];
  feedback: FeedbackRecord[];
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

export async function fetchAllSessionData(): Promise<AllAnalyticsData> {
  const [sessionsSnap, usersSnap, coursesSnap, enrollmentsSnap, feedbackSnap] = await Promise.all([
    getDocs(collection(db, collections.SESSIONS)),
    getDocs(collection(db, collections.USERS)),
    getDocs(collection(db, collections.COURSES)),
    getDocs(collection(db, collections.ENROLLMENTS)),
    getDocs(collection(db, collections.FEEDBACK)),
  ]);

  const sessions: SessionRecord[] = [];
  const attendanceMap = new Map<string, AttendanceRecord[]>();

  for (const sDoc of sessionsSnap.docs) {
    const sData = sDoc.data();
    sessions.push({
      id: sDoc.id,
      courseCode: sData.courseCode || '',
      courseName: sData.courseName || '',
      lecturerId: sData.lecturerId || '',
      lecturerName: sData.lecturerName || '',
      date: sData.date || '',
      startTime: sData.startTime || '',
      endTime: sData.endTime || '',
      enrolledCount: sData.enrolledCount || 0,
      status: sData.status || '',
      room: sData.room || '',
      topicOfDay: sData.topicOfDay || '',
    });

    try {
      const attSnap = await getDocs(collection(db, `${collections.SESSIONS}/${sDoc.id}/attendance`));
      attendanceMap.set(sDoc.id, attSnap.docs.map(d => ({
        studentId: d.data().studentId || '',
        studentName: d.data().studentName || '',
        timestamp: d.data().timestamp,
        status: d.data().status || 'present',
        deviceFingerprint: d.data().deviceFingerprint || '',
        studentEmail: d.data().studentEmail || '',
      })));
    } catch {
      attendanceMap.set(sDoc.id, []);
    }
  }

  const users: UserRecord[] = usersSnap.docs.map(d => ({
    uid: d.data().uid || d.id,
    name: d.data().name || '',
    role: d.data().role || '',
    department: d.data().department || '',
    email: d.data().email || '',
  }));

  const courses: CourseRecord[] = coursesSnap.docs.map(d => ({
    code: d.data().code || '',
    name: d.data().name || '',
    department: d.data().department || '',
    lecturer: d.data().lecturer || '',
  }));

  const enrollments: EnrollmentRecord[] = enrollmentsSnap.docs.map(d => ({
    courseCode: d.data().courseCode || '',
    studentId: d.data().studentId || '',
    studentName: d.data().studentName || '',
    program: d.data().program || '',
    enrolledAt: d.data().enrolledAt,
  }));

  const feedback: FeedbackRecord[] = feedbackSnap.docs.map(d => ({
    id: d.id,
    rating: d.data().rating || 0,
    comment: d.data().comment || '',
    courseCode: d.data().courseCode || '',
    courseName: d.data().courseName || '',
    lecturerId: d.data().lecturerId || '',
    lecturerName: d.data().lecturerName || '',
    studentId: d.data().studentId || '',
    studentName: d.data().studentName || '',
    createdAt: d.data().createdAt,
  }));

  return { sessions, attendanceMap, users, courses, enrollments, feedback };
}

// ─── Analytics Computations ───────────────────────────────────────────────────

function getSessionAttendanceRate(session: SessionRecord, attendance: AttendanceRecord[]): number {
  const enrolled = session.enrolledCount || 0;
  if (enrolled === 0) return 0;
  const present = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
  return Math.round((present / enrolled) * 100);
}

// 1. Lecturer Effectiveness
export function computeLecturerEffectiveness(data: AllAnalyticsData): LecturerEffectiveness[] {
  const lecturers = data.users.filter(u => u.role === 'lecturer');
  const result: LecturerEffectiveness[] = [];

  for (const lecturer of lecturers) {
    const lecturerSessions = data.sessions.filter(s => s.lecturerId === lecturer.uid);
    if (lecturerSessions.length === 0) continue;

    let totalRate = 0;
    let rateCount = 0;
    const studentSet = new Set<string>();

    for (const session of lecturerSessions) {
      const att = data.attendanceMap.get(session.id) || [];
      const rate = getSessionAttendanceRate(session, att);
      if (session.enrolledCount > 0) {
        totalRate += rate;
        rateCount++;
      }
      att.forEach(a => studentSet.add(a.studentId));
    }

    const feedbackScores = data.feedback.filter(f => f.lecturerId === lecturer.uid);
    const avgFeedback = feedbackScores.length > 0
      ? Math.round((feedbackScores.reduce((s, f) => s + f.rating, 0) / feedbackScores.length) * 10) / 10
      : 0;

    // Trend: compare first half vs second half
    const sorted = [...lecturerSessions].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const mid = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, mid);
    const secondHalf = sorted.slice(mid);

    const halfRate = (sessions: SessionRecord[]) => {
      if (sessions.length === 0) return 0;
      let sum = 0;
      let cnt = 0;
      for (const s of sessions) {
        const att = data.attendanceMap.get(s.id) || [];
        const r = getSessionAttendanceRate(s, att);
        if (s.enrolledCount > 0) { sum += r; cnt++; }
      }
      return cnt > 0 ? sum / cnt : 0;
    };

    const trend = Math.round(halfRate(secondHalf) - halfRate(firstHalf));

    result.push({
      lecturerId: lecturer.uid,
      name: lecturer.name,
      department: lecturer.department || 'Unassigned',
      sessionCount: lecturerSessions.length,
      avgAttendanceRate: rateCount > 0 ? Math.round(totalRate / rateCount) : 0,
      avgFeedbackScore: avgFeedback,
      totalStudents: studentSet.size,
      trend,
    });
  }

  return result.sort((a, b) => b.avgAttendanceRate - a.avgAttendanceRate);
}

// 2. Time Heatmap
export function computeTimeHeatmap(data: AllAnalyticsData): TimeHeatmapCell[] {
  const cells: TimeHeatmapCell[] = [];
  const grid = new Map<string, { count: number; totalRate: number }>();

  for (const session of data.sessions) {
    if (!session.date || !session.startTime) continue;
    const date = new Date(session.date);
    const day = date.getDay(); // 0=Sun, 6=Sat

    // Parse hour from startTime like "08:30"
    const hourMatch = session.startTime.match(/(\d{1,2}):(\d{2})/);
    if (!hourMatch) continue;
    let hour = parseInt(hourMatch[1], 10);
    // Handle 12 AM/PM
    if (session.startTime.toLowerCase().includes('pm') && hour < 12) hour += 12;
    if (session.startTime.toLowerCase().includes('am') && hour === 12) hour = 0;

    const key = `${day}-${hour}`;
    const att = data.attendanceMap.get(session.id) || [];
    const rate = getSessionAttendanceRate(session, att);
    const existing = grid.get(key) || { count: 0, totalRate: 0 };
    existing.count++;
    existing.totalRate += rate;
    grid.set(key, existing);
  }

  grid.forEach((value, key) => {
    const [day, hour] = key.split('-').map(Number);
    cells.push({
      day,
      hour,
      count: value.count,
      avgRate: value.count > 0 ? Math.round(value.totalRate / value.count) : 0,
    });
  });

  return cells;
}

// 3. Predictive Risk
export function computePredictiveRisk(data: AllAnalyticsData): PredictiveRisk[] {
  const result: PredictiveRisk[] = [];

  // Group attendance by student+course
  const studentCourseMap = new Map<string, {
    studentId: string;
    studentName: string;
    courseCode: string;
    courseName: string;
    rates: number[];
  }>();

  for (const session of data.sessions) {
    const att = data.attendanceMap.get(session.id) || [];
    for (const record of att) {
      const key = `${record.studentId}-${session.courseCode}`;
      const existing = studentCourseMap.get(key);
      const rate = getSessionAttendanceRate(session, [record]);
      if (existing) {
        existing.rates.push(rate);
      } else {
        studentCourseMap.set(key, {
          studentId: record.studentId,
          studentName: record.studentName,
          courseCode: session.courseCode,
          courseName: session.courseName,
          rates: [rate],
        });
      }
    }
  }

  studentCourseMap.forEach(entry => {
    if (entry.rates.length < 2) return;

    const currentRate = Math.round(entry.rates.reduce((s, r) => s + r, 0) / entry.rates.length);

    // Simple linear regression on recent rates
    const recentRates = entry.rates.slice(-10);
    const n = recentRates.length;
    if (n < 2) return;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += recentRates[i];
      sumXY += i * recentRates[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Project 5 sessions ahead
    const projectedRate = Math.round(intercept + slope * (n + 5));
    const projectedClamped = Math.max(0, Math.min(100, projectedRate));

    // Sessions until threshold (75%) if declining
    let sessionsToThreshold = -1;
    if (slope < 0 && currentRate > 75) {
      sessionsToThreshold = Math.ceil((75 - currentRate) / slope);
    }

    let riskLevel: 'high' | 'medium' | 'low' = 'low';
    if (projectedClamped < 50 || (slope < -5 && currentRate < 75)) riskLevel = 'high';
    else if (projectedClamped < 75 || slope < -3) riskLevel = 'medium';

    if (riskLevel !== 'low' || currentRate < 75) {
      result.push({
        studentId: entry.studentId,
        name: entry.studentName,
        courseCode: entry.courseCode,
        courseName: entry.courseName,
        currentRate,
        projectedRate: projectedClamped,
        riskLevel,
        sessionsToThreshold: sessionsToThreshold > 0 ? sessionsToThreshold : -1,
      });
    }
  });

  return result.sort((a, b) => a.projectedRate - b.projectedRate);
}

// 4. Department Stats
export function computeDepartmentStats(data: AllAnalyticsData): DepartmentStats[] {
  const deptMap = new Map<string, {
    totalStudents: number;
    totalSessions: number;
    totalRate: number;
    rateCount: number;
    courseSet: Set<string>;
  }>();

  // Map courses to departments
  const courseDeptMap = new Map<string, string>();
  data.courses.forEach(c => {
    if (c.code && c.department) courseDeptMap.set(c.code, c.department);
  });

  // Map lecturers to departments
  const lecturerDeptMap = new Map<string, string>();
  data.users.filter(u => u.role === 'lecturer').forEach(u => {
    lecturerDeptMap.set(u.uid, u.department || 'Unassigned');
  });

  // Count students per department via enrollments
  const deptStudents = new Map<string, Set<string>>();
  for (const e of data.enrollments) {
    const dept = courseDeptMap.get(e.courseCode) || 'Unassigned';
    if (!deptStudents.has(dept)) deptStudents.set(dept, new Set());
    deptStudents.get(dept)!.add(e.studentId);
  }

  // Count sessions and attendance per department
  for (const session of data.sessions) {
    const dept = lecturerDeptMap.get(session.lecturerId) || courseDeptMap.get(session.courseCode) || 'Unassigned';
    const existing = deptMap.get(dept) || {
      totalStudents: 0,
      totalSessions: 0,
      totalRate: 0,
      rateCount: 0,
      courseSet: new Set(),
    };

    existing.totalSessions++;
    existing.courseSet.add(session.courseCode);

    const att = data.attendanceMap.get(session.id) || [];
    const rate = getSessionAttendanceRate(session, att);
    if (session.enrolledCount > 0) {
      existing.totalRate += rate;
      existing.rateCount++;
    }

    deptMap.set(dept, existing);
  }

  const result: DepartmentStats[] = [];
  deptMap.forEach((value, dept) => {
    result.push({
      department: dept,
      totalStudents: deptStudents.get(dept)?.size || 0,
      totalSessions: value.totalSessions,
      avgAttendanceRate: value.rateCount > 0 ? Math.round(value.totalRate / value.rateCount) : 0,
      courseCount: value.courseSet.size,
    });
  });

  return result.sort((a, b) => b.avgAttendanceRate - a.avgAttendanceRate);
}

// 5. Feedback Correlation
export function computeFeedbackCorrelation(data: AllAnalyticsData): FeedbackCorrelation[] {
  const courseMap = new Map<string, {
    totalAttendanceRate: number;
    attendanceCount: number;
    totalFeedback: number;
    feedbackCount: number;
    courseName: string;
  }>();

  // Attendance rates per course
  for (const session of data.sessions) {
    const att = data.attendanceMap.get(session.id) || [];
    const rate = getSessionAttendanceRate(session, att);
    const existing = courseMap.get(session.courseCode) || {
      totalAttendanceRate: 0, attendanceCount: 0,
      totalFeedback: 0, feedbackCount: 0,
      courseName: session.courseName,
    };
    if (session.enrolledCount > 0) {
      existing.totalAttendanceRate += rate;
      existing.attendanceCount++;
    }
    existing.courseName = session.courseName || existing.courseName;
    courseMap.set(session.courseCode, existing);
  }

  // Feedback scores per course
  for (const fb of data.feedback) {
    const existing = courseMap.get(fb.courseCode) || {
      totalAttendanceRate: 0, attendanceCount: 0,
      totalFeedback: 0, feedbackCount: 0,
      courseName: fb.courseName,
    };
    existing.totalFeedback += fb.rating;
    existing.feedbackCount++;
    courseMap.set(fb.courseCode, existing);
  }

  const result: FeedbackCorrelation[] = [];
  courseMap.forEach((value, code) => {
    if (value.attendanceCount === 0 && value.feedbackCount === 0) return;
    result.push({
      courseCode: code,
      courseName: value.courseName,
      avgAttendance: value.attendanceCount > 0 ? Math.round(value.totalAttendanceRate / value.attendanceCount) : 0,
      avgFeedback: value.feedbackCount > 0 ? Math.round((value.totalFeedback / value.feedbackCount) * 10) / 10 : 0,
      sessionCount: value.attendanceCount,
    });
  });

  return result.filter(r => r.sessionCount > 0).sort((a, b) => b.avgAttendance - a.avgAttendance);
}

// 6. Geospatial Compliance
export function computeGeoCompliance(data: AllAnalyticsData): GeoCompliance {
  let totalCheckins = 0;
  let gpsCheckins = 0;
  let ipCheckins = 0;

  // Since GPS/IP compliance data isn't directly stored in attendance records,
  // we compute from sessions that had GPS/IP enabled
  for (const session of data.sessions) {
    const att = data.attendanceMap.get(session.id) || [];
    totalCheckins += att.length;

    // If session had GPS enabled, all checkins in it are GPS-validated
    if ((session as any).requireGps) {
      gpsCheckins += att.length;
    }
    if ((session as any).requireIpRange) {
      ipCheckins += att.length;
    }
  }

  return {
    totalCheckins,
    gpsCheckins,
    ipCheckins,
    gpsComplianceRate: totalCheckins > 0 ? Math.round((gpsCheckins / totalCheckins) * 100) : 0,
    ipComplianceRate: totalCheckins > 0 ? Math.round((ipCheckins / totalCheckins) * 100) : 0,
  };
}

// 7. Cohort Analytics
export function computeCohortAnalytics(data: AllAnalyticsData): CohortAnalytics[] {
  const programMap = new Map<string, {
    studentSet: Set<string>;
    totalRate: number;
    rateCount: number;
  }>();

  // Group students by program from enrollments
  const studentProgramMap = new Map<string, string>();
  for (const e of data.enrollments) {
    if (e.program) studentProgramMap.set(e.studentId, e.program);
  }

  // Compute attendance per program
  for (const session of data.sessions) {
    const att = data.attendanceMap.get(session.id) || [];
    for (const record of att) {
      const program = studentProgramMap.get(record.studentId) || 'Unknown';
      const existing = programMap.get(program) || {
        studentSet: new Set(),
        totalRate: 0,
        rateCount: 0,
      };
      existing.studentSet.add(record.studentId);
      const rate = getSessionAttendanceRate(session, [record]);
      existing.totalRate += rate;
      existing.rateCount++;
      programMap.set(program, existing);
    }
  }

  const result: CohortAnalytics[] = [];
  programMap.forEach((value, program) => {
    result.push({
      program,
      avgAttendanceRate: value.rateCount > 0 ? Math.round(value.totalRate / value.rateCount) : 0,
      studentCount: value.studentSet.size,
      sessionCount: value.rateCount,
    });
  });

  return result.sort((a, b) => b.avgAttendanceRate - a.avgAttendanceRate);
}

// 8. Operational Metrics
export function computeOperationalMetrics(data: AllAnalyticsData): OperationalMetrics {
  const totalSessions = data.sessions.length;
  const closedSessions = data.sessions.filter(s => s.status === 'closed').length;
  const openSessions = data.sessions.filter(s => s.status === 'open').length;

  // Average session duration
  let totalDuration = 0;
  let durationCount = 0;
  for (const session of data.sessions) {
    if (session.startTime && session.endTime) {
      const start = parseTimeToMinutes(session.startTime);
      const end = parseTimeToMinutes(session.endTime);
      if (start !== null && end !== null && end > start) {
        totalDuration += end - start;
        durationCount++;
      }
    }
  }

  // Peak day
  const dayCounts = new Map<string, number>();
  const hourCounts = new Map<number, number>();
  for (const session of data.sessions) {
    if (session.date) {
      const dayName = new Date(session.date).toLocaleDateString('en-US', { weekday: 'long' });
      dayCounts.set(dayName, (dayCounts.get(dayName) || 0) + 1);
    }
    if (session.startTime) {
      const hourMatch = session.startTime.match(/(\d{1,2}):(\d{2})/);
      if (hourMatch) {
        let hour = parseInt(hourMatch[1], 10);
        if (session.startTime.toLowerCase().includes('pm') && hour < 12) hour += 12;
        if (session.startTime.toLowerCase().includes('am') && hour === 12) hour = 0;
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      }
    }
  }

  let peakDay = 'No data';
  let maxDayCount = 0;
  dayCounts.forEach((count, day) => {
    if (count > maxDayCount) { maxDayCount = count; peakDay = day; }
  });

  let peakHour = 0;
  let maxHourCount = 0;
  hourCounts.forEach((count, hour) => {
    if (count > maxHourCount) { maxHourCount = count; peakHour = hour; }
  });

  // Sessions per week
  const weekMap = new Map<string, number>();
  for (const session of data.sessions) {
    if (session.date) {
      const d = new Date(session.date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().split('T')[0];
      weekMap.set(key, (weekMap.get(key) || 0) + 1);
    }
  }
  const sessionsPerWeek = Array.from(weekMap.entries())
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-12);

  return {
    totalSessions,
    avgSessionDurationMinutes: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
    peakDay,
    peakHour,
    sessionsPerWeek,
    closedSessions,
    openSessions,
  };
}

function parseTimeToMinutes(time: string): number | null {
  const match = time.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const min = parseInt(match[2], 10);
  if (time.toLowerCase().includes('pm') && hour < 12) hour += 12;
  if (time.toLowerCase().includes('am') && hour === 12) hour = 0;
  return hour * 60 + min;
}

// 9. Anomaly Detection
export function detectAnomalies(data: AllAnalyticsData): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // Detect sessions with 0% attendance
  for (const session of data.sessions) {
    if (session.status !== 'closed') continue;
    const att = data.attendanceMap.get(session.id) || [];
    const rate = getSessionAttendanceRate(session, att);
    if (rate === 0 && session.enrolledCount > 0) {
      anomalies.push({
        type: 'zero_attendance',
        description: `Zero attendance recorded for ${session.courseName}`,
        severity: 'high',
        courseCode: session.courseCode,
        date: session.date,
        details: `Session had ${session.enrolledCount} enrolled students but 0 check-ins.`,
      });
    }
    if (rate === 100 && session.enrolledCount > 10) {
      anomalies.push({
        type: 'perfect_session',
        description: `Perfect attendance for ${session.courseName}`,
        severity: 'low',
        courseCode: session.courseCode,
        date: session.date,
        details: `All ${session.enrolledCount} students checked in.`,
      });
    }
  }

  // Detect sudden drops per student
  const studentHistory = new Map<string, { courseCode: string; date: string; rate: number }[]>();
  for (const session of data.sessions) {
    const att = data.attendanceMap.get(session.id) || [];
    for (const record of att) {
      const key = `${record.studentId}-${session.courseCode}`;
      const existing = studentHistory.get(key) || [];
      existing.push({
        courseCode: session.courseCode,
        date: session.date,
        rate: getSessionAttendanceRate(session, [record]),
      });
      studentHistory.set(key, existing);
    }
  }

  studentHistory.forEach((history, key) => {
    const sorted = history.sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < sorted.length; i++) {
      const drop = sorted[i - 1].rate - sorted[i].rate;
      if (drop > 30) {
        const [studentId, courseCode] = key.split('-');
        const studentName = data.users.find(u => u.uid === studentId)?.name || studentId;
        anomalies.push({
          type: 'sudden_drop',
          description: `Attendance dropped ${drop}% for ${studentName}`,
          severity: 'medium',
          studentId,
          studentName,
          courseCode,
          date: sorted[i].date,
          details: `From ${sorted[i - 1].rate}% to ${sorted[i].rate}%`,
        });
      }
    }
  });

  // Detect high late count sessions
  for (const session of data.sessions) {
    const att = data.attendanceMap.get(session.id) || [];
    const lateCount = att.filter(a => a.status === 'late').length;
    if (att.length > 0 && lateCount / att.length > 0.5) {
      anomalies.push({
        type: 'high_late',
        description: `High late arrivals for ${session.courseName}`,
        severity: 'medium',
        courseCode: session.courseCode,
        date: session.date,
        details: `${lateCount} of ${att.length} students arrived late.`,
      });
    }
  }

  // Detect device reuse (same fingerprint, different students, same session)
  for (const session of data.sessions) {
    const att = data.attendanceMap.get(session.id) || [];
    const fingerprintMap = new Map<string, string[]>();
    for (const record of att) {
      if (!record.deviceFingerprint) continue;
      const existing = fingerprintMap.get(record.deviceFingerprint) || [];
      existing.push(record.studentName);
      fingerprintMap.set(record.deviceFingerprint, existing);
    }
    fingerprintMap.forEach((students, fp) => {
      if (students.length > 1) {
        anomalies.push({
          type: 'device_reuse',
          description: `Same device used by ${students.length} students`,
          severity: 'high',
          courseCode: session.courseCode,
          date: session.date,
          details: `Device fingerprint shared by: ${students.join(', ')}`,
        });
      }
    });
  }

  return anomalies.sort((a, b) => {
    const sevOrder = { high: 0, medium: 1, low: 2 };
    return sevOrder[a.severity] - sevOrder[b.severity];
  });
}

// 10. Goal Progress
export function computeGoalProgress(data: AllAnalyticsData, target: number = 85): GoalProgress {
  let totalRate = 0;
  let count = 0;

  for (const session of data.sessions) {
    if (session.enrolledCount === 0) continue;
    const att = data.attendanceMap.get(session.id) || [];
    const rate = getSessionAttendanceRate(session, att);
    totalRate += rate;
    count++;
  }

  const current = count > 0 ? Math.round(totalRate / count) : 0;

  // Trend: compare recent 7 sessions vs previous 7
  const sortedSessions = [...data.sessions]
    .filter(s => s.enrolledCount > 0)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const recent7 = sortedSessions.slice(0, 7);
  const prev7 = sortedSessions.slice(7, 14);

  const avgRate = (sessions: SessionRecord[]) => {
    if (sessions.length === 0) return 0;
    let sum = 0;
    for (const s of sessions) {
      const att = data.attendanceMap.get(s.id) || [];
      sum += getSessionAttendanceRate(s, att);
    }
    return Math.round(sum / sessions.length);
  };

  const recentAvg = avgRate(recent7);
  const prevAvg = avgRate(prev7);

  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (recentAvg > prevAvg + 2) trend = 'improving';
  else if (recentAvg < prevAvg - 2) trend = 'declining';

  return {
    target,
    current,
    percentage: Math.min(100, Math.round((current / target) * 100)),
    trend,
  };
}

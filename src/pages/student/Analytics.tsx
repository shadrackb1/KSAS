import React, { useMemo, useState, useEffect } from 'react';
import { Flame, Trophy, Lock, AlertTriangle, Loader2, TrendingUp, TrendingDown, Minus, Users, Shield } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useFirestoreRealtimeCollection } from '../../hooks/useFirestoreRealtime';
import { db, collection, getDocs, query, where } from '../../lib/firebase';
import { collections } from '../../lib/db';
import { EXAM_ELIGIBILITY_THRESHOLD } from '../../lib/gamification';
import { CountUp } from '../../components/charts';

export default function Analytics() {
  const { user } = useAuth();

  const { data: enrollments } = useFirestoreRealtimeCollection(collections.ENROLLMENTS);
  const { data: courses } = useFirestoreRealtimeCollection(collections.COURSES);
  const { data: allSessions, loading: loadingSessions } = useFirestoreRealtimeCollection(collections.SESSIONS);

  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(true);

  const studentEnrollments = useMemo(() => {
    return enrollments.filter(e => e.studentId === user?.uid);
  }, [enrollments, user]);

  const courseCodes = useMemo(() => {
    return studentEnrollments.map(e => e.courseCode);
  }, [studentEnrollments]);

  useEffect(() => {
    if (!user?.uid || courseCodes.length === 0) {
      setLoadingAttendance(false);
      return;
    }
    if (loadingSessions) return;

    const fetchAttendance = async () => {
      const list: any[] = [];

      for (const session of allSessions) {
        if (!courseCodes.includes(session.courseCode)) continue;
        try {
          const attQ = query(
            collection(db, `${collections.SESSIONS}/${session.id}/attendance`),
            where('studentId', '==', user.uid)
          );
          const attSnap = await getDocs(attQ);
          if (attSnap.size > 0) {
            const attData = attSnap.docs[0].data();
            list.push({
              sessionId: session.id,
              courseCode: session.courseCode,
              courseName: session.courseName,
              date: session.date,
              status: attData.status || 'present',
              timestamp: attData.timestamp,
            });
          }
        } catch (e) {
          // ignore
        }
      }

      setAttendanceList(list);
      setLoadingAttendance(false);
    };

    fetchAttendance();
  }, [user, courseCodes, allSessions, loadingSessions]);

  const overall = useMemo(() => {
    const present = attendanceList.filter(a => a.status === 'present').length;
    const late = attendanceList.filter(a => a.status === 'late').length;
    const total = attendanceList.length;
    const pct = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    return { attended: present + late, total, pct };
  }, [attendanceList]);

  const streakData = useMemo(() => {
    const dates: string[] = attendanceList
      .filter((a: any) => a.date)
      .map((a: any) => a.date)
      .sort()
      .reverse();
    
    if (dates.length === 0) return { current: 0, longest: 0 };

    // Remove duplicates (same date multiple sessions)
    const unique = [...new Set(dates)].sort().reverse() as string[];

    let current = 1;
    for (let i = 1; i < unique.length; i++) {
      const prev = new Date(unique[i - 1]);
      const curr = new Date(unique[i]);
      const diffDays = (prev.getTime() - curr.getTime()) / 86400000;
      if (diffDays === 1) current++;
      else break;
    }

    // Longest streak
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
  }, [attendanceList]);

  const riskCourses = useMemo(() => {
    const result: { code: string; name: string; pct: number }[] = [];

    for (const code of courseCodes) {
      const courseSessions = allSessions.filter(s => s.courseCode === code);
      const courseAtt = attendanceList.filter(a => a.courseCode === code);
      const total = courseSessions.length;
      if (total === 0) continue;
      const present = courseAtt.filter(a => a.status !== 'absent').length;
      const pct = Math.round((present / total) * 100);
      if (pct < EXAM_ELIGIBILITY_THRESHOLD) {
        const course = courses.find(c => c.code === code);
        result.push({ code, name: course?.name || code, pct });
      }
    }

    return result.sort((a, b) => a.pct - b.pct);
  }, [courseCodes, allSessions, attendanceList, courses]);

  // Comparative analytics: student's rate vs class average per course
  const [courseComparison, setCourseComparison] = useState<{ code: string; name: string; myRate: number; classAvg: number; diff: number }[]>([]);

  useEffect(() => {
    if (courseCodes.length === 0 || allSessions.length === 0) return;

    const computeComparison = async () => {
      const result: { code: string; name: string; myRate: number; classAvg: number; diff: number }[] = [];

      for (const code of courseCodes) {
        const courseSessions = allSessions.filter(s => s.courseCode === code);
        if (courseSessions.length === 0) continue;

        const myAtt = attendanceList.filter(a => a.courseCode === code);
        const myPresent = myAtt.filter(a => a.status !== 'absent').length;
        const myRate = courseSessions.length > 0 ? Math.round((myPresent / courseSessions.length) * 100) : 0;

        let classTotal = 0;
        let classAttended = 0;
        for (const session of courseSessions) {
          try {
            const attSnap = await getDocs(collection(db, `${collections.SESSIONS}/${session.id}/attendance`));
            const attCount = attSnap.size;
            classTotal += session.enrolledCount || attCount;
            classAttended += attCount;
          } catch { /* skip */ }
        }
        const classAvg = classTotal > 0 ? Math.round((classAttended / classTotal) * 100) : 0;
        const course = courses.find(c => c.code === code);
        result.push({ code, name: course?.name || code, myRate, classAvg, diff: myRate - classAvg });
      }

      setCourseComparison(result.sort((a, b) => b.diff - a.diff));
    };

    computeComparison();
  }, [courseCodes, allSessions, attendanceList, courses]);

  // Trend: compare recent attendance vs older attendance
  const attendanceTrend = useMemo(() => {
    if (attendanceList.length < 4) return { direction: 'stable' as const, change: 0 };

    const sorted = [...attendanceList].sort((a: any, b: any) => {
      const da = a.date || '';
      const db = b.date || '';
      return da.localeCompare(db);
    });

    const mid = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, mid);
    const secondHalf = sorted.slice(mid);

    const rateHalf = (list: any[]) => {
      if (list.length === 0) return 0;
      const present = list.filter(a => a.status !== 'absent').length;
      return Math.round((present / list.length) * 100);
    };

    const olderRate = rateHalf(firstHalf);
    const recentRate = rateHalf(secondHalf);
    const change = recentRate - olderRate;

    let direction: 'improving' | 'declining' | 'stable' = 'stable';
    if (change > 5) direction = 'improving';
    else if (change < -5) direction = 'declining';

    return { direction, change };
  }, [attendanceList]);

  if (loadingSessions || loadingAttendance) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (courseCodes.length === 0) {
    return (
      <div className="flex-1 w-full px-4 md:px-6 py-8 max-w-7xl mx-auto animate-page-in">
        <header className="mb-8">
          <h1 className="font-headline-lg text-primary mb-2">Analytics</h1>
          <p className="font-body-md text-on-surface-variant">Track your attendance performance across all enrolled units.</p>
        </header>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Shield className="w-12 h-12 mb-4 text-outline" />
          <p className="font-bold text-on-surface mb-1">No courses enrolled</p>
          <p className="text-sm text-on-surface-variant">Enroll in courses to see your analytics here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full px-4 md:px-6 py-8 max-w-7xl mx-auto animate-page-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <header className="mb-8">
        <h1 className="font-headline-lg text-primary mb-2">Analytics</h1>
        <p className="font-body-md text-on-surface-variant">Track your attendance performance across all enrolled units.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl p-6 relative flex flex-col md:flex-row items-center gap-8 border border-outline-variant/20" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="flex-1 text-center md:text-left">
            <h2 className="font-title-lg font-bold text-primary mb-2">Overall Attendance</h2>
            <p className="font-body-md text-on-surface-variant mb-6">
              {overall.pct >= EXAM_ELIGIBILITY_THRESHOLD ? 'You are maintaining good attendance this semester. You are eligible for exams!' :
               overall.pct >= 50 ? `Your attendance needs improvement. You need ${EXAM_ELIGIBILITY_THRESHOLD}% for exam eligibility.` :
               'Your attendance is critically low. Immediate action is required for exam eligibility.'}
            </p>
            
            <div className="flex flex-wrap gap-4 justify-center md:justify-start">
              <div className="bg-surface-container-low px-4 py-3 rounded-lg border border-outline-variant/30">
                <p className="font-label-md text-on-surface-variant mb-1">Classes Attended</p>
                <p className="font-headline-md text-primary"><CountUp value={overall.attended} decimals={0} /></p>
              </div>
              <div className="bg-surface-container-low px-4 py-3 rounded-lg border border-outline-variant/30">
                <p className="font-label-md text-on-surface-variant mb-1">Total Classes</p>
                <p className="font-headline-md text-primary"><CountUp value={overall.total} decimals={0} /></p>
              </div>
            </div>
          </div>
          
          <div className="w-48 h-48 shrink-0 flex items-center justify-center relative">
             <svg className="w-full h-full transform -rotate-90">
              <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-surface-container-low"></circle>
              <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray="502.4" strokeDashoffset={502.4 - (502.4 * overall.pct / 100)} strokeLinecap="round" className={overall.pct < 50 ? 'text-error' : overall.pct < EXAM_ELIGIBILITY_THRESHOLD ? 'text-secondary' : 'text-success'}></circle>
            </svg>
            <span className="absolute font-display-lg text-primary"><CountUp value={overall.pct} suffix="%" decimals={0} /></span>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-6 flex flex-col justify-center items-center text-center border border-outline-variant/20">
          <div className={`w-16 h-16 rounded-full ${streakData.current > 0 ? 'bg-error-container text-error' : 'bg-surface-variant text-on-surface-variant'} flex items-center justify-center mb-4`}>
            <Flame className="w-8 h-8 fill-current" />
          </div>
          <h3 className="font-title-lg font-bold text-primary mb-1">Attendance Streak</h3>
          <p className="font-body-sm text-on-surface-variant mb-6">Consecutive days with attendance</p>
          
          <div className="flex items-center justify-center gap-8 w-full">
            <div>
              <p className="font-headline-md text-primary leading-none"><CountUp value={streakData.current} decimals={0} /></p>
              <p className="font-label-md text-on-surface-variant mt-2">Current</p>
            </div>
            <div className="w-px h-12 bg-outline-variant/30"></div>
            <div>
              <p className="font-headline-md text-on-surface-variant leading-none"><CountUp value={streakData.longest} decimals={0} /></p>
              <p className="font-label-md text-on-surface-variant mt-2">Longest</p>
            </div>
          </div>
        </div>
      </div>

      {/* Exam Eligibility Overview */}
      <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-title-lg font-bold text-primary">Exam Eligibility</h3>
          <Shield className="text-on-surface-variant w-6 h-6" />
        </div>
        <p className="font-body-sm text-on-surface-variant mb-4">Minimum {EXAM_ELIGIBILITY_THRESHOLD}% attendance required per unit to sit for exams.</p>
        <div className="space-y-3">
          {courseCodes.map(code => {
            const courseSessions = allSessions.filter(s => s.courseCode === code);
            const courseAtt = attendanceList.filter(a => a.courseCode === code);
            const total = courseSessions.length;
            if (total === 0) return null;
            const attended = courseAtt.filter(a => a.status !== 'absent').length;
            const pct = Math.round((attended / total) * 100);
            const eligible = pct >= EXAM_ELIGIBILITY_THRESHOLD;
            const course = courses.find(c => c.code === code);
            return (
              <div key={code} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: eligible ? 'var(--success-container/10)' : 'var(--error-container/10)', border: `1px solid ${eligible ? 'var(--success)' : 'var(--error)'}20` }}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${eligible ? 'bg-success/20' : 'bg-error/20'}`}>
                  {eligible ? <Shield className="w-4 h-4 text-success" /> : <AlertTriangle className="w-4 h-4 text-error" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body-md font-bold text-primary">{code}</p>
                  <p className="font-body-sm text-on-surface-variant truncate">{course?.name || code}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`font-headline-md font-bold ${eligible ? 'text-success' : 'text-error'}`}><CountUp value={pct} suffix="%" decimals={0} /></span>
                  <p className={`font-label-md mt-0.5 ${eligible ? 'text-success' : 'text-error'}`}>
                    {eligible ? 'Eligible' : 'At Risk'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/20">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-title-lg font-bold text-primary">Milestones & Achievements</h3>
            <Trophy className="text-success w-6 h-6 fill-current" />
          </div>
          
          <div className="space-y-4">
            <div className={`flex items-start gap-4 p-3 rounded-lg ${overall.total > 0 && overall.pct === 100 ? 'bg-surface-container-low border border-outline-variant/30' : 'bg-surface-variant/30 border border-outline-variant/20 opacity-70 grayscale'}`}>
               <div className={`w-10 h-10 rounded-full ${overall.total > 0 && overall.pct === 100 ? 'bg-secondary-container text-primary' : 'bg-surface-dim text-on-surface-variant'} flex items-center justify-center shrink-0`}>
                 <Trophy className="w-5 h-5 fill-current" />
               </div>
               <div>
                 <h4 className="font-body-md font-bold text-primary">Perfect Attendance</h4>
                 <p className="font-body-sm text-on-surface-variant">Attended every session</p>
               </div>
               <div className="ml-auto flex items-center h-full">
                 {overall.total > 0 && overall.pct === 100 ? (
                   <span className="font-label-md text-success bg-success-container/20 px-2 py-1 rounded-full">Unlocked</span>
                 ) : (
                   <span className="font-label-md text-on-surface-variant">{overall.total > 0 ? `${overall.pct}%` : 'No data'}</span>
                 )}
               </div>
            </div>

            <div className={`flex items-start gap-4 p-3 rounded-lg ${streakData.current >= 5 ? 'bg-surface-container-low border border-outline-variant/30' : 'bg-surface-variant/30 border border-outline-variant/20 opacity-70 grayscale'}`}>
               <div className={`w-10 h-10 rounded-full ${streakData.current >= 5 ? 'bg-secondary-container text-primary' : 'bg-surface-dim text-on-surface-variant'} flex items-center justify-center shrink-0`}>
                 <Trophy className="w-5 h-5 fill-current" />
               </div>
               <div>
                 <h4 className="font-body-md font-bold text-primary">Consistent Attendee</h4>
                 <p className="font-body-sm text-on-surface-variant">Attend 5+ consecutive days</p>
               </div>
               <div className="ml-auto flex items-center h-full">
                 {streakData.current >= 5 ? (
                   <span className="font-label-md text-success bg-success-container/20 px-2 py-1 rounded-full">Unlocked</span>
                 ) : (
                   <span className="font-label-md text-on-surface-variant">{streakData.current}/5</span>
                 )}
               </div>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-6 border border-l-error border-l-4 border-y border-r border-outline-variant/20">
           <div className="flex items-center justify-between mb-6">
            <h3 className="font-title-lg font-bold text-primary">Exam Eligibility Alerts</h3>
            <AlertTriangle className="text-error w-6 h-6 fill-current" />
          </div>
          <p className="font-body-sm text-on-surface-variant mb-4">Courses below the {EXAM_ELIGIBILITY_THRESHOLD}% mandatory attendance threshold for exam eligibility.</p>
          
          {riskCourses.length === 0 ? (
            <div className="bg-surface-container-low p-4 rounded-lg text-center text-on-surface-variant">
              All your courses are above the {EXAM_ELIGIBILITY_THRESHOLD}% threshold. You are eligible for exams!
            </div>
          ) : (
          <div className="space-y-4">
            {riskCourses.map(c => (
            <div key={c.code} className="bg-error-container/30 p-4 rounded-lg border border-error/20">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-body-md font-bold text-on-error-container">{c.code}</h4>
                <span className="font-headline-md font-bold text-error">{c.pct}%</span>
              </div>
              <p className="font-body-sm text-on-surface-variant mb-3">{c.name}</p>
              <div className="w-full bg-surface-dim rounded-full h-2 mb-1 overflow-hidden">
                <div className="bg-error h-full rounded-full" style={{ width: `${c.pct}%` }}></div>
              </div>
              <p className="font-label-md text-error text-right mt-1">Exam eligibility at risk</p>
            </div>
            ))}
          </div>
          )}
        </div>

      </div>

      {/* Comparative Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Class Comparison */}
        <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/20">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-title-lg font-bold text-primary">Your Performance vs Class</h3>
            <Users className="text-on-surface-variant w-6 h-6" />
          </div>
          {courseComparison.length === 0 ? (
            <div className="bg-surface-container-low p-4 rounded-lg text-center text-on-surface-variant">
              Comparing your attendance to class averages...
            </div>
          ) : (
            <div className="space-y-4">
              {courseComparison.map(c => (
                <div key={c.code} className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/20">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <h4 className="font-body-md font-bold text-primary">{c.code}</h4>
                      <p className="font-body-sm text-on-surface-variant">{c.name}</p>
                    </div>
                    <div className="text-right">
                      <span className={`font-headline-md font-bold ${c.diff >= 0 ? 'text-success' : 'text-error'}`}>
                        {c.diff > 0 ? '+' : ''}{c.diff}%
                      </span>
                      <p className="font-label-md text-on-surface-variant mt-1">vs class avg</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs text-on-surface-variant mb-1">
                        <span>You: {c.myRate}%</span>
                        <span>Class: {c.classAvg}%</span>
                      </div>
                      <div className="h-2 bg-surface-dim rounded-full overflow-hidden relative">
                        <div className="h-full bg-success rounded-full absolute" style={{ width: `${c.myRate}%` }}></div>
                        <div className="h-full bg-on-surface-variant/30 rounded-full absolute" style={{ width: `${c.classAvg}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Semester Trend */}
        <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/20">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-title-lg font-bold text-primary">Attendance Trend</h3>
            {attendanceTrend.direction === 'improving' ? (
              <TrendingUp className="text-success w-6 h-6" />
            ) : attendanceTrend.direction === 'declining' ? (
              <TrendingDown className="text-error w-6 h-6" />
            ) : (
              <Minus className="text-on-surface-variant w-6 h-6" />
            )}
          </div>

          <div className="text-center mb-6">
            <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-4 ${
              attendanceTrend.direction === 'improving' ? 'bg-success-container text-success' :
              attendanceTrend.direction === 'declining' ? 'bg-error-container text-error' :
              'bg-surface-variant text-on-surface-variant'
            }`}>
              {attendanceTrend.direction === 'improving' ? (
                <TrendingUp className="w-10 h-10" />
              ) : attendanceTrend.direction === 'declining' ? (
                <TrendingDown className="w-10 h-10" />
              ) : (
                <Minus className="w-10 h-10" />
              )}
            </div>
            <h4 className="font-title-lg font-bold text-primary mb-2">
              {attendanceTrend.direction === 'improving' ? 'Improving' :
               attendanceTrend.direction === 'declining' ? 'Declining' : 'Stable'}
            </h4>
            <p className="font-body-sm text-on-surface-variant">
              {attendanceTrend.direction === 'improving'
                ? `Your attendance has improved by ${attendanceTrend.change}% in recent sessions.`
                : attendanceTrend.direction === 'declining'
                ? `Your attendance has dropped by ${Math.abs(attendanceTrend.change)}% in recent sessions.`
                : 'Your attendance has remained consistent.'}
            </p>
          </div>

          <div className="p-4 rounded-lg bg-surface-container-low border border-outline-variant/20">
            <div className="flex items-center justify-between mb-2">
              <span className="font-body-sm text-on-surface-variant">Recent sessions</span>
              <span className="font-headline-sm text-primary">{Math.round((attendanceList.slice(Math.floor(attendanceList.length / 2)).filter((a: any) => a.status !== 'absent').length / Math.max(1, Math.ceil(attendanceList.length / 2))) * 100)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-body-sm text-on-surface-variant">Older sessions</span>
              <span className="font-headline-sm text-on-surface-variant">{Math.round((attendanceList.slice(0, Math.floor(attendanceList.length / 2)).filter((a: any) => a.status !== 'absent').length / Math.max(1, Math.floor(attendanceList.length / 2))) * 100)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

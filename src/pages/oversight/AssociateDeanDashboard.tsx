import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Users, GraduationCap, AlertTriangle, Star, BarChart3, Shield } from 'lucide-react';
import { useFirestoreRealtimeCollection } from '../../hooks/useFirestoreRealtime';
import { collections } from '../../lib/db';
import { useAuth } from '../../hooks/useAuth';
import { DonutChart, CountUp, getRateColor } from '../../components/charts';

const DEPT_SHORT: Record<string, string> = {
  'Computer Science': 'CS',
  'Mathematics': 'MATH',
  'Physics': 'PHY',
  'Chemistry': 'CHEM',
  'Business': 'BIZ',
  'Education': 'EDU',
  'Law': 'LAW',
  'Nursing': 'NUR',
};

function computeDeptStats(sessions: any[], enrollments: any[], courses: any[]) {
  const deptMap: Record<string, { students: Set<string>; present: number; absent: number; courses: number; lecturers: Set<string> }> = {};

  for (const c of courses) {
    const dept = c.department || 'Other';
    if (!deptMap[dept]) deptMap[dept] = { students: new Set(), present: 0, absent: 0, courses: 0, lecturers: new Set() };
    deptMap[dept].courses++;
    if (c.lecturerId) deptMap[dept].lecturers.add(c.lecturerId);
  }

  for (const e of enrollments) {
    const dept = e.department || 'Other';
    if (!deptMap[dept]) deptMap[dept] = { students: new Set(), present: 0, absent: 0, courses: 0, lecturers: new Set() };
    deptMap[dept].students.add(e.studentId || e.userId);
  }

  for (const s of sessions) {
    const dept = s.department || 'Other';
    if (!deptMap[dept]) deptMap[dept] = { students: new Set(), present: 0, absent: 0, courses: 0, lecturers: new Set() };
    if (Array.isArray(s.attendance)) {
      for (const a of s.attendance) {
        if (a.status === 'present' || a.status === 'late') deptMap[dept].present++;
        else deptMap[dept].absent++;
      }
    }
  }

  return Object.entries(deptMap).map(([name, d]) => {
    const total = d.present + d.absent;
    return {
      name: DEPT_SHORT[name] || name,
      fullName: name,
      students: d.students.size,
      lecturers: d.lecturers.size,
      present: d.present,
      absent: d.absent,
      rate: total > 0 ? Math.round((d.present / total) * 100) : 0,
      courses: d.courses,
    };
  }).sort((a, b) => b.rate - a.rate);
}

export default function AssociateDeanDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: users } = useFirestoreRealtimeCollection(collections.USERS);
  const { data: courses } = useFirestoreRealtimeCollection(collections.COURSES);
  const { data: sessions } = useFirestoreRealtimeCollection(collections.SESSIONS);
  const { data: enrollments } = useFirestoreRealtimeCollection(collections.ENROLLMENTS);

  const facultyCourses = useMemo(() => {
    if (!user?.faculty) return courses;
    return courses.filter(c => c.faculty === user.faculty);
  }, [courses, user]);

  const facultySessions = useMemo(() => {
    const courseCodes = new Set(facultyCourses.map(c => c.code));
    return sessions.filter(s => courseCodes.has(s.courseCode));
  }, [sessions, facultyCourses]);

  const facultyEnrollments = useMemo(() => {
    const courseCodes = new Set(facultyCourses.map(c => c.code));
    return enrollments.filter(e => courseCodes.has(e.courseCode));
  }, [enrollments, facultyCourses]);

  const deptStats = useMemo(() => computeDeptStats(facultySessions, facultyEnrollments, facultyCourses), [facultySessions, facultyEnrollments, facultyCourses]);

  const overallAttendance = useMemo(() => {
    let present = 0, total = 0;
    for (const s of facultySessions) {
      const sc = s.enrolledCount || 0;
      const ac = s.attendanceCount || 0;
      total += sc;
      present += ac;
    }
    return total > 0 ? Math.round((present / total) * 100) : 0;
  }, [facultySessions]);

  const todaySessions = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return facultySessions.filter(s => s.date === today);
  }, [facultySessions]);

  const liveSessions = useMemo(() => facultySessions.filter(s => s.status === 'open'), [facultySessions]);

  return (
    <div className="animate-page-in" style={{ padding: '28px 36px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      
      {/* Header — medium whitespace, Gloock serif for page title only */}
      <div className="mb-6">
        <h1 style={{ fontFamily: 'Gloock, serif', fontSize: '28px', fontWeight: 400, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '4px' }}>
          Faculty Comparison
        </h1>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 300 }}>
          Side-by-side departmental performance and enrollment health
        </p>
      </div>

      {/* Stat Row — medium density, 4-up */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Overall Rate', value: overallAttendance, suffix: '%', color: getRateColor(overallAttendance) },
          { label: 'Departments', value: deptStats.length, color: 'var(--text-primary)' },
          { label: 'Live Sessions', value: liveSessions.length, color: liveSessions.length > 0 ? 'var(--success)' : 'var(--text-primary)' },
          { label: 'Today', value: todaySessions.length, suffix: ' sessions', color: 'var(--text-primary)' },
        ].map(s => (
          <div key={s.label} className="p-4 text-center" style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)' }}>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>{s.label}</p>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '26px', fontWeight: 500, color: s.color }}>
              <CountUp value={s.value} />{s.suffix || ''}
            </p>
          </div>
        ))}
      </div>

      {/* Small Multiples — side-by-side department cards */}
      <div className="mb-6">
        <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Department Comparison</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {deptStats.map(dept => (
            <div key={dept.name} className="p-4" style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)' }}>
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{dept.fullName || dept.name}</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '18px', fontWeight: 600, color: getRateColor(dept.rate) }}>{dept.rate}%</span>
              </div>
              <div className="h-2.5 rounded-full mb-3" style={{ background: 'var(--bg-border)' }}>
                <div style={{ width: `${dept.rate}%`, height: '100%', borderRadius: '999px', background: getRateColor(dept.rate), transition: 'width 0.8s ease' }} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{dept.students}</p>
                  <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '9px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Students</p>
                </div>
                <div className="text-center">
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{dept.courses}</p>
                  <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '9px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Courses</p>
                </div>
                <div className="text-center">
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{dept.lecturers}</p>
                  <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '9px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lecturers</p>
                </div>
              </div>
            </div>
          ))}
          {deptStats.length === 0 && (
            <div className="col-span-full text-center py-8">
              <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', color: 'var(--text-tertiary)' }}>No departmental data available.</p>
            </div>
          )}
        </div>
      </div>

      {/* Two-column: Today + Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {todaySessions.length > 0 && (
          <div className="p-5" style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)' }}>
            <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Today's Sessions</h3>
            <div className="space-y-3">
              {todaySessions.slice(0, 8).map((s: any) => {
                const total = s.enrolledCount || 0;
                const present = s.attendanceCount || 0;
                const rate = total > 0 ? Math.round((present / total) * 100) : 0;
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--gold-primary)', minWidth: '72px' }}>{s.courseCode}</span>
                    <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--bg-border)' }}>
                      <div style={{ width: `${rate}%`, height: '100%', borderRadius: '999px', background: getRateColor(rate), transition: 'width 0.6s ease' }} />
                    </div>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', fontWeight: 500, color: 'var(--text-primary)', minWidth: '32px', textAlign: 'right' }}>{rate}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Department leaderboard */}
        <div className="p-5" style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)' }}>
          <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Departmental Leaderboard</h3>
          <div className="space-y-3">
            {deptStats.slice(0, 6).map((dept, i) => (
              <div key={dept.name} className="flex items-center gap-3">
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: i === 0 ? 'var(--gold-primary)' : 'var(--text-tertiary)', minWidth: '18px', textAlign: 'center' }}>{i + 1}</span>
                <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', color: 'var(--text-primary)', flex: 1 }}>{dept.fullName || dept.name}</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: 600, color: getRateColor(dept.rate) }}>{dept.rate}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '32px', paddingTop: '12px', borderTop: '0.5px solid var(--bg-border)', textAlign: 'center' }}>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '10px', color: 'var(--text-tertiary)' }}>
          KSAS — Faculty Comparison Dashboard
        </p>
      </div>
    </div>
  );
}

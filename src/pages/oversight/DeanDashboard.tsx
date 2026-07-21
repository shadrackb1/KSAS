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
  'Medicine & Health Sciences': 'MHS',
  'Music & Media': 'MM',
  'Pharmacy': 'PHARM',
  'Science, Engineering & Technology': 'SSET',
  'Education, Humanities & Social Sciences': 'SEHSS',
  'Business & Economics': 'SBE',
};

function computeDeptStats(sessions: any[], enrollments: any[], courses: any[]) {
  const deptMap: Record<string, { students: Set<string>; present: number; absent: number; courses: number }> = {};

  for (const c of courses) {
    const dept = c.department || 'Other';
    if (!deptMap[dept]) deptMap[dept] = { students: new Set(), present: 0, absent: 0, courses: 0 };
    deptMap[dept].courses++;
  }

  for (const e of enrollments) {
    const dept = e.department || 'Other';
    if (!deptMap[dept]) deptMap[dept] = { students: new Set(), present: 0, absent: 0, courses: 0 };
    deptMap[dept].students.add(e.studentId || e.userId);
  }

  for (const s of sessions) {
    const dept = s.department || 'Other';
    if (!deptMap[dept]) deptMap[dept] = { students: new Set(), present: 0, absent: 0, courses: 0 };
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
      present: d.present,
      absent: d.absent,
      rate: total > 0 ? Math.round((d.present / total) * 100) : 0,
      courses: d.courses,
    };
  }).sort((a, b) => b.rate - a.rate);
}

export default function DeanDashboard() {
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

  const totalStudents = useMemo(() => {
    const ids = new Set(facultyEnrollments.map(e => e.studentId || e.userId));
    return ids.size;
  }, [facultyEnrollments]);

  const deptStats = useMemo(() => computeDeptStats(facultySessions, facultyEnrollments, facultyCourses), [facultySessions, facultyEnrollments, facultyCourses]);

  const attendanceStatusDonut = useMemo(() => {
    let present = 0, late = 0, absent = 0;
    for (const s of facultySessions) {
      if (Array.isArray(s.attendance)) {
        for (const a of s.attendance) {
          if (a.status === 'present') present++;
          else if (a.status === 'late') late++;
          else absent++;
        }
      }
    }
    const total = present + late + absent;
    if (total === 0) return [];
    return [
      { name: 'Present', value: present, color: 'var(--success)' },
      { name: 'Late', value: late, color: 'var(--warning)' },
      { name: 'Absent', value: absent, color: 'var(--danger)' },
    ].filter(d => d.value > 0);
  }, [facultySessions]);

  const todaySessions = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return facultySessions.filter(s => s.date === today);
  }, [facultySessions]);

  const overallAttendance = useMemo(() => {
    let present = 0, total = 0;
    for (const s of facultySessions) {
      const sc = s.enrolledCount || (Array.isArray(s.attendance) ? s.attendance.length : 0);
      const ac = s.attendanceCount || (Array.isArray(s.attendance) ? s.attendance.filter((a: any) => a.status === 'present' || a.status === 'late').length : 0);
      total += sc;
      present += ac;
    }
    return total > 0 ? Math.round((present / total) * 100) : 0;
  }, [facultySessions]);

  const liveSessions = useMemo(() => facultySessions.filter(s => s.status === 'open'), [facultySessions]);

  return (
    <div className="animate-page-in" style={{ padding: '32px 40px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      
      {/* Header — generous whitespace, Gloock serif hero */}
      <div className="mb-8">
        <h1 style={{ fontFamily: 'Gloock, serif', fontSize: '32px', fontWeight: 400, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '4px' }}>
          Institutional Overview
        </h1>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 300 }}>
          Faculty-wide attendance performance and departmental standing
        </p>
      </div>

      {/* Hero Metric — large serif number in generous card */}
      <div className="mb-8 p-8 text-center" style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.03, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Shield style={{ width: '180px', height: '180px', color: 'var(--kabu-maroon)' }} />
        </div>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>
          Faculty-Wide Attendance
        </p>
        <div style={{ fontFamily: 'Gloock, serif', fontSize: '64px', fontWeight: 400, color: getRateColor(overallAttendance), letterSpacing: '-0.03em', lineHeight: 1 }}>
          <CountUp value={overallAttendance} />%
        </div>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
          across {facultyCourses.length} courses · {totalStudents.toLocaleString()} students
        </p>
      </div>

      {/* Stat Tiles — spacious, 3-up */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        {[
          { label: 'Total Students', value: totalStudents, color: 'var(--text-primary)' },
          { label: 'Departments', value: deptStats.length, color: 'var(--text-primary)' },
          { label: 'Live Sessions', value: liveSessions.length, color: liveSessions.length > 0 ? 'var(--success)' : 'var(--text-primary)' },
        ].map(s => (
          <div key={s.label} className="p-5 text-center" style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)' }}>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>{s.label}</p>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '28px', fontWeight: 500, color: s.color }}>
              <CountUp value={s.value} />
            </p>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Attendance donut + Narrative cards */}
        <div className="space-y-6">
          {attendanceStatusDonut.length > 0 && (
            <div className="p-5" style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)' }}>
              <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Attendance Breakdown</h3>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <DonutChart
                  data={attendanceStatusDonut}
                  size={200}
                  centerLabel={`${facultySessions.length}`}
                  centerSubLabel="sessions"
                />
              </div>
            </div>
          )}

          {/* Today's sessions summary */}
          {todaySessions.length > 0 && (
            <div className="p-5" style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)' }}>
              <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Today's Sessions</h3>
              <div className="space-y-3">
                {todaySessions.slice(0, 6).map((s: any) => {
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
        </div>

        {/* Right: Department comparison */}
        <div className="p-5" style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)' }}>
          <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Departmental Standing</h3>
          <div className="space-y-4">
            {deptStats.map(dept => (
              <div key={dept.name}>
                <div className="flex items-center justify-between mb-1">
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{dept.fullName || dept.name}</span>
                  <div className="flex items-center gap-2">
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: 'var(--text-tertiary)' }}>{dept.students} students</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: 600, color: getRateColor(dept.rate) }}>{dept.rate}%</span>
                  </div>
                </div>
                <div className="h-2 rounded-full" style={{ background: 'var(--bg-border)' }}>
                  <div style={{ width: `${dept.rate}%`, height: '100%', borderRadius: '999px', background: getRateColor(dept.rate), transition: 'width 0.8s ease' }} />
                </div>
              </div>
            ))}
            {deptStats.length === 0 && (
              <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px' }}>No departmental data available.</p>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '40px', paddingTop: '16px', borderTop: '0.5px solid var(--bg-border)', textAlign: 'center' }}>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '10px', color: 'var(--text-tertiary)' }}>
          KSAS — Faculty Attendance Oversight
        </p>
      </div>
    </div>
  );
}

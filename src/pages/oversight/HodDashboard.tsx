import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Users, GraduationCap, AlertTriangle, Star, BarChart3, Radio, Wifi } from 'lucide-react';
import { useFirestoreRealtimeCollection } from '../../hooks/useFirestoreRealtime';
import { collections } from '../../lib/db';
import { useAuth } from '../../hooks/useAuth';
import { DonutChart, Sparkline, CountUp, getRateColor } from '../../components/charts';
import LiveTeachingMonitor from './LiveTeachingMonitor';
import LecturerOversight from './LecturerOversight';

export default function HodDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: users } = useFirestoreRealtimeCollection(collections.USERS);
  const { data: courses } = useFirestoreRealtimeCollection(collections.COURSES);
  const { data: sessions } = useFirestoreRealtimeCollection(collections.SESSIONS);
  const { data: enrollments } = useFirestoreRealtimeCollection(collections.ENROLLMENTS);

  const deptCourses = useMemo(() => {
    if (!user?.department) return courses;
    return courses.filter(c => c.department === user.department);
  }, [courses, user]);

const deptSessions = useMemo(() => {
  const courseCodes = new Set(deptCourses.map(c => c.code));
  return sessions.filter(s => courseCodes.has(s.courseCode));
}, [sessions, deptCourses]);

const deptEnrollments = useMemo(() => {
  const courseCodes = new Set(deptCourses.map(c => c.code));
  return enrollments.filter(e => courseCodes.has(e.courseCode));
}, [enrollments, deptCourses]);

  const totalStudents = useMemo(() => {
    const ids = new Set(deptEnrollments.map(e => e.studentId || e.userId));
    return ids.size;
  }, [deptEnrollments]);

const deptLecturers = useMemo(() => {
  const ids = new Set(deptCourses.map(c => c.lecturer).filter(Boolean));
  return users.filter(u => ids.has(u.id));
}, [users, deptCourses]);

  const overallAttendance = useMemo(() => {
    let present = 0, total = 0;
    for (const s of deptSessions) {
      const sc = s.enrolledCount || 0;
      const ac = s.attendanceCount || 0;
      total += sc;
      present += ac;
    }
    return total > 0 ? Math.round((present / total) * 100) : 0;
  }, [deptSessions]);

  const liveSessions = useMemo(() => deptSessions.filter(s => s.status === 'open'), [deptSessions]);

  const attendanceStatusDonut = useMemo(() => {
    let present = 0, late = 0, absent = 0;
    for (const s of deptSessions) {
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
  }, [deptSessions]);

  const courseRateHistory = useMemo(() => {
    const sorted = [...deptSessions].sort((a, b) => {
      const ta = a.date ? new Date(a.date).getTime() : 0;
      const tb = b.date ? new Date(b.date).getTime() : 0;
      return ta - tb;
    });
    
    const byCourse: Record<string, { dates: string[]; rates: number[] }> = {};
    for (const s of sorted) {
      if (!s.courseCode) continue;
      if (!byCourse[s.courseCode]) byCourse[s.courseCode] = { dates: [], rates: [] };
      const total = s.enrolledCount || 0;
      const present = s.attendanceCount || 0;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      byCourse[s.courseCode].dates.push(s.date || '');
      byCourse[s.courseCode].rates.push(rate);
    }
    return byCourse;
  }, [deptSessions]);

  return (
    <div className="animate-page-in" style={{ padding: '28px 36px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      
      {/* Header — sans throughout, no serif */}
      <div className="mb-5">
        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          Departmental Pulse
        </h1>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 300 }}>
          Live monitoring and operational oversight for {user?.department || 'your department'}
        </p>
      </div>

      {/* Live indicator banner */}
      {liveSessions.length > 0 && (
        <div className="flex items-center gap-3 mb-5 p-3" style={{ background: 'var(--success-bg)', border: '0.5px solid var(--success)', borderRadius: 'var(--radius-md)' }}>
          <Radio className="w-4 h-4" style={{ color: 'var(--success)', animation: 'pulse 2s infinite' }} />
          <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontWeight: 500, color: 'var(--success)' }}>
            {liveSessions.length} session{liveSessions.length !== 1 ? 's' : ''} live in your department right now
          </span>
        </div>
      )}

      {/* Stat Tiles — compact, below hero */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Attendance', value: overallAttendance, suffix: '%', color: getRateColor(overallAttendance) },
          { label: 'Students', value: totalStudents, color: 'var(--text-primary)' },
          { label: 'Lecturers', value: deptLecturers.length, color: 'var(--text-primary)' },
          { label: 'Courses', value: deptCourses.length, color: 'var(--text-primary)' },
        ].map(s => (
          <div key={s.label} className="p-3 text-center" style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '10px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '4px' }}>{s.label}</p>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '22px', fontWeight: 500, color: s.color }}>
              <CountUp value={s.value} />{s.suffix || ''}
            </p>
          </div>
        ))}
      </div>

      {/* Main content: Live Monitor takes prominence */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Live Teaching Monitor — largest module, 2/3 width */}
        <div className="lg:col-span-2" style={{ minHeight: '360px' }}>
          <LiveTeachingMonitor />
        </div>

        {/* Right sidebar — Attendance donut + sparklines */}
        <div className="space-y-5">
          {attendanceStatusDonut.length > 0 && (
            <div className="p-4" style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)' }}>
              <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Attendance Status</h3>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <DonutChart
                  data={attendanceStatusDonut}
                  size={160}
                  centerLabel={`${deptSessions.length}`}
                  centerSubLabel="sessions"
                />
              </div>
            </div>
          )}

          {/* Course sparklines — small multiples */}
          {Object.keys(courseRateHistory).length > 0 && (
            <div className="p-4" style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)' }}>
              <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>Rate Trends</h3>
              <div className="space-y-3">
                {Object.entries(courseRateHistory).slice(0, 5).map(([code, data]) => {
                  const latest = data.rates[data.rates.length - 1] || 0;
                  return (
                    <div key={code}>
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: 'var(--gold-primary)' }}>{code}</span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', fontWeight: 500, color: getRateColor(latest) }}>{latest}%</span>
                      </div>
                      <Sparkline data={data.rates} width={200} height={28} color={getRateColor(latest)} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lecturer Oversight — full width, scrollable list */}
      <div className="mb-5">
        <LecturerOversight />
      </div>

      {/* Footer */}
      <div style={{ marginTop: '24px', paddingTop: '12px', borderTop: '0.5px solid var(--bg-border)', textAlign: 'center' }}>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '10px', color: 'var(--text-tertiary)' }}>
          KSAS — Departmental Operations Dashboard
        </p>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}`}</style>
    </div>
  );
}

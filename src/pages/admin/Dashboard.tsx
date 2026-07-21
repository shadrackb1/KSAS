import React, { useMemo, useState, useEffect } from 'react';
import { Shield, Users, UserPlus, Activity, Info, Star, Loader2, GraduationCap, BookOpen, Radio, BarChart3, FileText, Settings, UserCheck, ClipboardList, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFirestoreRealtimeCollection } from '../../hooks/useFirestoreRealtime';
import { db, collection, getDocs, query, orderBy, limit } from '../../lib/firebase';
import { collections } from '../../lib/db';

export default function AdminDashboard() {
  const navigate = useNavigate();
  
  const { data: users } = useFirestoreRealtimeCollection(collections.USERS);
  const { data: courses } = useFirestoreRealtimeCollection(collections.COURSES);
  const { data: sessions } = useFirestoreRealtimeCollection(collections.SESSIONS);
  const { data: enrollments } = useFirestoreRealtimeCollection(collections.ENROLLMENTS);

  const totalStudents = useMemo(() => users.filter(u => u.role === 'student').length, [users]);
  const totalLecturers = useMemo(() => users.filter(u => u.role === 'lecturer').length, [users]);
  const activeSessions = useMemo(() => sessions.filter(s => s.status === 'open').length, [sessions]);
  const totalEnrolled = useMemo(() => enrollments.length, [enrollments]);
  const totalCourses = useMemo(() => courses.length, [courses]);
  const totalUsers = useMemo(() => users.length, [users]);

  const recentlyEnrolled = useMemo(() => {
    return [...enrollments]
      .sort((a, b) => {
        const ta = a.enrolledAt ? new Date(a.enrolledAt).getTime() : 0;
        const tb = b.enrolledAt ? new Date(b.enrolledAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 12);
  }, [enrollments]);

const totalSessions = sessions.length;
const manualCount = useMemo(() => sessions.reduce((acc, s) => acc + (s.manualCount || 0), 0), [sessions]);
const leftEarlyCount = useMemo(() => sessions.reduce((acc, s) => acc + (s.leftEarlyCount || 0), 0), [sessions]);

const todaySessions = useMemo(() => {
  const today = new Date().toISOString().split('T')[0];
  return sessions.filter(s => s.date === today);
}, [sessions]);

  const todayAttendance = useMemo(() => {
    let totalPresent = 0;
    let totalEnrolledToday = 0;
    for (const s of todaySessions) {
      totalEnrolledToday += s.enrolledCount || 0;
      totalPresent += s.attendanceCount || 0;
    }
    return { totalPresent, totalEnrolledToday, rate: totalEnrolledToday > 0 ? Math.round((totalPresent / totalEnrolledToday) * 100) : 0 };
  }, [todaySessions]);

  const [recentFeedback, setRecentFeedback] = useState<any[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(true);

  useEffect(() => {
    (async () => {
      setLoadingFeedback(true);
      try {
        const q = query(collection(db, collections.FEEDBACK), orderBy('createdAt', 'desc'), limit(15));
        const snap = await getDocs(q);
        setRecentFeedback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch {
        setRecentFeedback([]);
      } finally {
        setLoadingFeedback(false);
      }
    })();
  }, []);

  return (
    <div className="animate-page-in" style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      
      {/* Header — Outfit sans only, no serif */}
      <div className="mb-5">
        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          Control Center
        </h1>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 300 }}>
          Kabarak University — System Operations Dashboard
        </p>
      </div>

      {/* ── Dense Stat Strip ── compact, high-frequency tiles ── */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-5">
        {[
          { label: 'Users', value: totalUsers, icon: Users, accent: false },
          { label: 'Students', value: totalStudents, icon: GraduationCap, accent: false },
          { label: 'Lecturers', value: totalLecturers, icon: UserCheck, accent: false },
          { label: 'Courses', value: totalCourses, icon: BookOpen, accent: false },
          { label: 'Enrollments', value: totalEnrolled, icon: ClipboardList, accent: false },
          { label: 'Live', value: activeSessions, icon: Radio, accent: activeSessions > 0 },
        ].map((stat) => (
          <div
            key={stat.label}
            className="p-3 flex flex-col gap-1"
            style={{
              background: stat.accent ? 'var(--success-bg)' : 'var(--bg-surface)',
              border: `0.5px solid ${stat.accent ? 'var(--success)' : 'var(--bg-border)'}`,
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '10px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                {stat.label}
              </span>
              <stat.icon className="w-3.5 h-3.5" style={{ color: stat.accent ? 'var(--success)' : 'var(--text-tertiary)', opacity: 0.6 }} />
            </div>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '22px', fontWeight: 500, color: stat.accent ? 'var(--success)' : 'var(--text-primary)' }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Today's Quick Stats ── inline row ── */}
      {todaySessions.length > 0 && (
        <div className="flex items-center gap-4 mb-5 p-3" style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-md)' }}>
          <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Today</span>
          <div className="flex items-center gap-1.5">
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{todaySessions.length}</span>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px', color: 'var(--text-tertiary)' }}>sessions</span>
          </div>
          <div className="w-px h-4" style={{ background: 'var(--bg-border)' }} />
          <div className="flex items-center gap-1.5">
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 500, color: 'var(--success)' }}>{todayAttendance.totalPresent}</span>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px', color: 'var(--text-tertiary)' }}>present</span>
          </div>
          <div className="w-px h-4" style={{ background: 'var(--bg-border)' }} />
          <div className="flex items-center gap-1.5">
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 500, color: todayAttendance.rate >= 75 ? 'var(--success)' : 'var(--danger)' }}>{todayAttendance.rate}%</span>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px', color: 'var(--text-tertiary)' }}>rate</span>
          </div>
        </div>
      )}

      {/* ── Quick Actions — MOST prominent section ── */}
      <div className="mb-5">
        <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '10px' }}>
          Quick Actions
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: 'Create User', icon: UserPlus, path: '/admin/users/create', color: 'var(--kabu-maroon)', bg: 'var(--kabu-maroon-tint)' },
            { label: 'Manage Users', icon: Users, path: '/admin/users', color: 'var(--text-primary)', bg: 'var(--bg-elevated)' },
            { label: 'Courses', icon: BookOpen, path: '/admin/courses', color: 'var(--text-primary)', bg: 'var(--bg-elevated)' },
            { label: 'Archive', icon: ClipboardList, path: '/admin/archive', color: 'var(--text-primary)', bg: 'var(--bg-elevated)' },
            { label: 'Analytics', icon: BarChart3, path: '/admin/analytics', color: 'var(--text-primary)', bg: 'var(--bg-elevated)' },
            { label: 'Reports', icon: FileText, path: '/admin/reports', color: 'var(--text-primary)', bg: 'var(--bg-elevated)' },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className="flex flex-col items-center justify-center p-4 transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: action.bg,
                border: `0.5px solid ${action.color === 'var(--kabu-maroon)' ? 'var(--kabu-maroon-subtle)' : 'var(--bg-border)'}`,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              <action.icon className="w-5 h-5 mb-1.5" style={{ color: action.color }} />
              <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: action.color, textAlign: 'center' }}>
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Content: Two-column dense layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        
        {/* Left column — Dense lists (3/5 width) */}
        <div className="lg:col-span-3 space-y-5">
          
          {/* Recently Enrolled — dense table */}
          {recentlyEnrolled.length > 0 && (
            <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)' }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '0.5px solid var(--bg-border)' }}>
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" style={{ color: 'var(--gold-primary)' }} />
                  <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Recently Enrolled</h3>
                </div>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--text-tertiary)' }}>{totalEnrolled} total</span>
              </div>
              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Student', 'Course', 'Date'].map(h => (
                        <th key={h} style={{ fontFamily: 'Outfit, sans-serif', fontSize: '10px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', textAlign: 'left', padding: '6px 12px', borderBottom: '0.5px solid var(--bg-border)', position: 'sticky', top: 0, background: 'var(--bg-surface)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentlyEnrolled.map((e) => (
                      <tr key={e.id} className="hover:bg-bg-elevated/50 transition-colors">
                        <td style={{ padding: '7px 12px', fontFamily: 'Outfit, sans-serif', fontSize: '12px', color: 'var(--text-primary)' }}>
                          {e.studentName || '—'}
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: 'var(--text-tertiary)', marginLeft: '4px' }}>{e.studentId}</span>
                        </td>
                        <td style={{ padding: '7px 12px', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--gold-primary)' }}>{e.courseCode}</td>
                        <td style={{ padding: '7px 12px', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                          {e.enrolledAt ? new Date(e.enrolledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent Feedback — dense list */}
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)' }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '0.5px solid var(--bg-border)' }}>
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4" style={{ color: 'var(--gold-primary)' }} />
                <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Recent Feedback</h3>
              </div>
            </div>
            {loadingFeedback ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--kabu-maroon)' }} /></div>
            ) : recentFeedback.length === 0 ? (
              <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px' }}>No feedback yet.</p>
            ) : (
              <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                {recentFeedback.map((fb: any) => (
                  <div key={fb.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-bg-elevated/50 transition-colors" style={{ borderBottom: '0.5px solid var(--bg-border)' }}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>Anonymous</span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: 'var(--text-tertiary)' }}>{fb.courseCode}</span>
                      </div>
                      <div className="flex items-center gap-0.5 mt-0.5">
                        {[1, 2, 3, 4, 5].map(n => (
                          <Star key={n} className="w-3 h-3" style={{ fill: n <= (fb.rating || 0) ? 'var(--gold-primary)' : 'none', color: n <= (fb.rating || 0) ? 'var(--gold-primary)' : 'var(--text-tertiary)' }} />
                        ))}
                      </div>
                      {fb.comment && (
                        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>"{fb.comment}"</p>
                      )}
                    </div>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', marginTop: '2px' }}>
                      {fb.createdAt?.toDate?.()?.toLocaleDateString() || ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column — System info (2/5 width) */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* System Summary */}
          <div className="p-4" style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4" style={{ color: 'var(--gold-primary)' }} />
              <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>System Summary</h3>
            </div>
            <div className="space-y-2.5">
              {[
                { label: 'Total Users', value: totalUsers },
                { label: 'Students', value: totalStudents },
                { label: 'Lecturers', value: totalLecturers },
                { label: 'Courses', value: totalCourses },
                { label: 'Sessions', value: sessions.length },
                { label: 'Enrollments', value: totalEnrolled },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', color: 'var(--text-secondary)' }}>{item.label}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="p-4" style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Quick Stats</h3>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', color: 'var(--text-secondary)' }}>Student: Lecturer</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 500, color: 'var(--kabu-maroon)' }}>
                  {totalLecturers > 0 ? (totalStudents / totalLecturers).toFixed(1) : '--'}:1
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', color: 'var(--text-secondary)' }}>Sessions / Course</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 500, color: 'var(--kabu-maroon)' }}>
                  {totalCourses > 0 ? (sessions.length / totalCourses).toFixed(1) : '--'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', color: 'var(--text-secondary)' }}>Active Sessions</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 500, color: activeSessions > 0 ? 'var(--success)' : 'var(--text-primary)' }}>
                  {activeSessions}
                </span>
              </div>
            </div>
          </div>

          {/* Live indicator */}
          {activeSessions > 0 && (
            <div className="p-3 flex items-center gap-3" style={{ background: 'var(--success-bg)', border: '0.5px solid var(--success)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', animation: 'pulse 2s infinite' }} />
              <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', fontWeight: 500, color: 'var(--success)' }}>
                {activeSessions} session{activeSessions !== 1 ? 's' : ''} live right now
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '32px', paddingTop: '12px', borderTop: '0.5px solid var(--bg-border)', textAlign: 'center' }}>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '10px', color: 'var(--text-tertiary)' }}>
          KSAS — Kabarak University Attendance System
        </p>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}`}</style>
    </div>
  );
}

// OVERSIGHT TIER — READ-ONLY. No create, edit, or delete actions. All data is scoped read from Firestore.
import React, { useMemo, useState, useEffect } from 'react';
import {
  Users, BookOpen, Activity, Eye, AlertTriangle, Loader2, Radio, GraduationCap, BarChart3,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useFirestoreRealtimeCollection } from '../../hooks/useFirestoreRealtime';
import { db, collection, getDocs, query, where, orderBy, limit } from '../../lib/firebase';
import { collections } from '../../lib/db';
import toast from 'react-hot-toast';

export default function OversightDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: users, loading: loadingUsers } = useFirestoreRealtimeCollection(collections.USERS);
  const { data: courses, loading: loadingCourses } = useFirestoreRealtimeCollection(collections.COURSES);
  const { data: sessions, loading: loadingSessions } = useFirestoreRealtimeCollection(collections.SESSIONS);
  const { data: enrollments } = useFirestoreRealtimeCollection(collections.ENROLLMENTS);
  const { data: allFeedback } = useFirestoreRealtimeCollection(collections.FEEDBACK);

  const scopeFilter = user?.role === 'hod' ? 'department' : user?.role === 'dean' ? 'faculty' : null;
  const scopeValue = user ? (user as any)[scopeFilter || ''] : null;

  const scopeUsers = useMemo(() => {
    if (!scopeFilter || !user) return users;
    return users.filter((u: any) => (u as any)[scopeFilter] === (user as any)[scopeFilter]);
  }, [users, scopeFilter, user]);

  const scopeStudents = useMemo(() => scopeUsers.filter((u: any) => u.role === 'student'), [scopeUsers]);
  const scopeLecturers = useMemo(() => scopeUsers.filter((u: any) => u.role === 'lecturer'), [scopeUsers]);

  const scopeCourses = useMemo(() => {
    if (!scopeFilter || !user) return courses;
    return courses.filter((c: any) => !c[scopeFilter] || c[scopeFilter] === (user as any)[scopeFilter]);
  }, [courses, scopeFilter, user]);

  const scopeCourseCodes = useMemo(() => new Set(scopeCourses.map((c: any) => c.code)), [scopeCourses]);

  const scopeSessions = useMemo(() => sessions.filter((s: any) => scopeCourseCodes.has(s.courseCode)), [sessions, scopeCourseCodes]);
  const scopeEnrollments = useMemo(() => enrollments.filter((e: any) => scopeCourseCodes.has(e.courseCode)), [enrollments, scopeCourseCodes]);

  const activeSessions = useMemo(() => scopeSessions.filter((s: any) => s.status === 'open').length, [scopeSessions]);

  const attendanceRate = useMemo(() => {
    let totalPresent = 0;
    let totalEnrolled = 0;
    scopeSessions.forEach((s: any) => {
      totalEnrolled += s.enrolledCount || 0;
      totalPresent += s.attendanceCount || 0;
    });
    return totalEnrolled > 0 ? Math.round((totalPresent / totalEnrolled) * 100) : 0;
  }, [scopeSessions]);

  const flaggedCount = useMemo(() => {
    return scopeLecturers.filter((l: any) => (l.punctualityScore || 100) < 85 || (l.noShowCount || 0) > 3).length;
  }, [scopeLecturers]);

  const [recentCheckIns, setRecentCheckIns] = useState<any[]>([]);
  const [loadingCheckIns, setLoadingCheckIns] = useState(true);

  useEffect(() => {
    (async () => {
      setLoadingCheckIns(true);
      try {
        const allSnap = await getDocs(query(collection(db, collections.SESSIONS), orderBy('createdAt', 'desc'), limit(50)));
        const recentSess = allSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((s: any) => scopeCourseCodes.has(s.courseCode));
        const checkIns: any[] = [];
        for (const s of (recentSess as any[]).slice(0, 10)) {
          try {
            const attSnap = await getDocs(collection(db, `${collections.SESSIONS}/${s.id}/attendance`));
            attSnap.docs.forEach((d: any) => {
              checkIns.push({ id: d.id, sessionId: s.id, courseCode: s.courseCode, courseName: s.courseName, date: s.date, ...d.data() });
            });
          } catch { /* skip */ }
        }
        checkIns.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
        setRecentCheckIns(checkIns.slice(0, 10));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingCheckIns(false);
      }
    })();
  }, [scopeCourseCodes]);

  const isLoading = loadingUsers || loadingCourses || loadingSessions;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#8B1538' }} />
      </div>
    );
  }

  return (
    <div className="animate-page-in px-4 py-6 sm:px-6 md:px-8 lg:px-12 lg:py-10" style={{ maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <section className="mb-6">
        <h1 style={{ fontFamily: 'Gloock, serif', fontSize: 'clamp(20px,3vw,28px)', color: '#1A0508', letterSpacing: '-0.01em' }}>
          Oversight Dashboard
        </h1>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', color: '#6B4A50', fontWeight: 300 }}>
          Scope: {scopeValue || 'All'} · Read-Only Access · {user?.name || 'Oversight Officer'}
        </p>
      </section>

      {/* KPI Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
        {[
          { label: 'Active Sessions', value: activeSessions, icon: Radio, color: '#8B1538' },
          { label: 'Lecturers', value: scopeLecturers.length, icon: GraduationCap, color: '#8B1538' },
          { label: 'Students', value: scopeStudents.length, icon: Users, color: '#8B1538' },
          { label: 'Attendance Rate', value: `${attendanceRate}%`, icon: Activity, color: attendanceRate >= 75 ? '#2d8a56' : '#8B1538' },
          { label: 'Flagged', value: flaggedCount, icon: AlertTriangle, color: flaggedCount > 0 ? '#C9A84C' : '#8B1538' },
        ].map((stat) => (
          <div key={stat.label} className="p-4 sm:p-5 flex flex-col gap-3" style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8D8DA' }}>
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B4A50' }}>
                {stat.label}
              </span>
              <div className="flex items-center justify-center" style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#F9E8EA' }}>
                <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
              </div>
            </div>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '28px', fontWeight: 500, color: '#1A0508' }}>
              {stat.value}
            </p>
          </div>
        ))}
      </section>

      {/* Quick Links */}
      <section className="mb-8">
        <h2 style={{ fontFamily: 'Big Shoulders Display, sans-serif', fontSize: '18px', color: '#1A0508', marginBottom: '12px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
          Quick Access
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Live Teaching Monitor', desc: 'Real-time session overview', icon: Radio, path: '/oversight/live-teaching', color: '#8B1538' },
            { label: 'Lecturer Oversight', desc: 'Performance & punctuality tracking', icon: GraduationCap, path: '/oversight/lecturer-oversight', color: '#6B4A50' },
            { label: 'Department Analytics', desc: 'Trends & comparative data', icon: BarChart3, path: '/oversight/department-analytics', color: '#C9A84C' },
          ].map((link) => (
            <button
              key={link.label}
              onClick={() => navigate(link.path)}
              className="w-full text-left p-5 transition-all"
              style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8D8DA', cursor: 'pointer' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center" style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#F9E8EA' }}>
                  <link.icon className="w-5 h-5" style={{ color: link.color }} />
                </div>
                <div>
                  <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '14px', fontWeight: 600, color: '#1A0508' }}>{link.label}</p>
                  <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', color: '#6B4A50' }}>{link.desc}</p>
                </div>
              </div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', color: '#8B1538', fontWeight: 500 }}>
                View →
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Recent Activity Feed */}
      <section>
        <h2 style={{ fontFamily: 'Big Shoulders Display, sans-serif', fontSize: '18px', color: '#1A0508', marginBottom: '12px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
          Recent Activity
        </h2>
        <div className="p-5" style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8D8DA' }}>
          {loadingCheckIns ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: '#8B1538' }} /></div>
          ) : recentCheckIns.length === 0 ? (
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '14px', color: '#6B4A50', textAlign: 'center', padding: '24px' }}>
              No recent check-ins in scope.
            </p>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {recentCheckIns.map((ci, i) => (
                <div key={ci.id} className="flex items-center justify-between gap-3 py-3" style={{ borderBottom: i < recentCheckIns.length - 1 ? '0.5px solid #E8D8DA' : 'none' }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center shrink-0" style={{ width: '36px', height: '36px', borderRadius: '50%', background: ci.status === 'present' ? '#e8f5ed' : ci.status === 'late' ? '#fef3cd' : '#fde8e8' }}>
                      <Eye className="w-4 h-4" style={{ color: ci.status === 'present' ? '#2d8a56' : ci.status === 'late' ? '#C9A84C' : '#8B1538' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontWeight: 500, color: '#1A0508' }}>
                        {ci.studentName || ci.studentId || 'Unknown'}
                      </p>
                      <p className="truncate" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px', color: '#6B4A50', marginTop: '1px' }}>
                        {ci.courseName || ci.courseCode} · {ci.date}
                      </p>
                    </div>
                  </div>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', fontWeight: 500, padding: '3px 10px', borderRadius: '8px', background: ci.status === 'present' ? '#e8f5ed' : ci.status === 'late' ? '#fef3cd' : '#fde8e8', color: ci.status === 'present' ? '#2d8a56' : ci.status === 'late' ? '#C9A84C' : '#8B1538', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                    {ci.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

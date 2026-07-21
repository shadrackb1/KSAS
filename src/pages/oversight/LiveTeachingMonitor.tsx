// OVERSIGHT TIER — READ-ONLY. No create, edit, or delete actions. All data is scoped read from Firestore.
import React, { useMemo, useState, useEffect } from 'react';
import { Radio, MapPin, Users, Clock, Loader2, Wifi } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useFirestoreRealtimeCollection } from '../../hooks/useFirestoreRealtime';
import { db, collection, onSnapshot, orderBy, limit, getDocs } from '../../lib/firebase';
import { collections } from '../../lib/db';

interface SessionWithProgress {
  id: string;
  courseCode: string;
  courseName: string;
  lecturerName: string;
  room: string;
  date: string;
  startTime: string;
  status: string;
  enrolledCount: number;
  attendanceCount: number;
  progress: number;
}

export default function LiveTeachingMonitor() {
  const { user } = useAuth();

  const { data: courses, loading: loadingCourses } = useFirestoreRealtimeCollection(collections.COURSES);
  const { data: baseSessions, loading: loadingSessions } = useFirestoreRealtimeCollection(collections.SESSIONS);

  const scopeFilter = user?.role === 'hod' ? 'department' : user?.role === 'dean' ? 'faculty' : null;

  const scopeCourses = useMemo(() => {
    if (!scopeFilter || !user) return courses;
    return courses.filter((c: any) => !c[scopeFilter] || c[scopeFilter] === (user as any)[scopeFilter]);
  }, [courses, scopeFilter, user]);

  const scopeCourseCodes = useMemo(() => new Set(scopeCourses.map((c: any) => c.code)), [scopeCourses]);

  const scopeSessions = useMemo(() => baseSessions.filter((s: any) => scopeCourseCodes.has(s.courseCode)), [baseSessions, scopeCourseCodes]);

  const [sessionsWithProgress, setSessionsWithProgress] = useState<SessionWithProgress[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [liveUpdating, setLiveUpdating] = useState(true);

  const activeNow = useMemo(() => sessionsWithProgress.filter(s => s.status === 'open'), [sessionsWithProgress]);

  useEffect(() => {
    if (scopeSessions.length === 0) {
      setSessionsWithProgress([]);
      setLoadingProgress(false);
      return;
    }
    setLoadingProgress(true);
    const unsubscribers: (() => void)[] = [];
    const results: SessionWithProgress[] = [];
    let loadedCount = 0;

    scopeSessions.forEach((s: any) => {
      const attCollRef = collection(db, `${collections.SESSIONS}/${s.id}/attendance`);
      const unsub = onSnapshot(attCollRef, (snap) => {
        const existing = results.findIndex(r => r.id === s.id);
        const entry: SessionWithProgress = {
          id: s.id,
          courseCode: s.courseCode,
          courseName: s.courseName,
          lecturerName: s.lecturerName,
          room: s.room,
          date: s.date,
          startTime: s.startTime,
          status: s.status,
          enrolledCount: s.enrolledCount || 0,
          attendanceCount: snap.size,
          progress: s.enrolledCount ? Math.min(100, Math.round((snap.size / s.enrolledCount) * 100)) : 0,
        };
        if (existing >= 0) {
          results[existing] = entry;
        } else {
          results.push(entry);
        }
        loadedCount++;
      }, () => { loadedCount++; });
      unsubscribers.push(unsub);
    });

    const checkDone = setInterval(() => {
      if (loadedCount >= scopeSessions.length) {
        clearInterval(checkDone);
        setSessionsWithProgress([...results]);
        setLoadingProgress(false);
      }
    }, 200);

    return () => {
      clearInterval(checkDone);
      unsubscribers.forEach(u => u());
    };
  }, [scopeSessions]);

  useEffect(() => {
    const t = setTimeout(() => setLiveUpdating(false), 10000);
    return () => clearTimeout(t);
  }, []);

  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      open: { bg: '#e8f5ed', color: '#2d8a56', label: 'Active' },
      closed: { bg: '#f0f0f0', color: '#6B4A50', label: 'Ended' },
      cancelled: { bg: '#fde8e8', color: '#8B1538', label: 'Cancelled' },
      scheduled: { bg: '#fef3cd', color: '#8a6d0f', label: 'Scheduled' },
    };
    return map[status] || map.closed;
  };

  const isLoading = loadingCourses || loadingSessions;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#8B1538' }} />
      </div>
    );
  }

  return (
    <div className="animate-page-in px-4 py-6 sm:px-6 md:px-8 lg:px-12 lg:py-10" style={{ maxWidth: '1280px', margin: '0 auto' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}`}</style>

      {/* Header */}
      <section className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 style={{ fontFamily: 'Gloock, serif', fontSize: 'clamp(20px,3vw,28px)', color: '#1A0508', letterSpacing: '-0.01em' }}>
              Live Teaching Monitor
            </h1>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', color: '#6B4A50', fontWeight: 300 }}>
              Scope: {user ? ((user as any)[scopeFilter || ''] || 'All') : 'All'} · Read-Only
            </p>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '9999px', background: liveUpdating ? '#e8f5ed' : '#f9e8ea', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: 500, color: liveUpdating ? '#2d8a56' : '#8B1538' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: liveUpdating ? '#2d8a56' : '#8B1538', animation: liveUpdating ? 'pulse 2s infinite' : 'none' }} />
            {liveUpdating ? 'Live updating…' : 'Updates paused'}
          </span>
        </div>
      </section>

      {/* Active Count Badge */}
      <section className="mb-6">
        <div className="p-4 flex items-center gap-3" style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8D8DA' }}>
          <div className="flex items-center justify-center" style={{ width: '44px', height: '44px', borderRadius: '50%', background: activeNow.length > 0 ? '#e8f5ed' : '#f0f0f0' }}>
            <Radio className="w-5 h-5" style={{ color: activeNow.length > 0 ? '#2d8a56' : '#6B4A50' }} />
          </div>
          <div>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '24px', fontWeight: 500, color: '#1A0508' }}>
              {activeNow.length} Active Session{activeNow.length !== 1 ? 's' : ''}
            </p>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', color: '#6B4A50' }}>
              {sessionsWithProgress.length} total in scope · {activeNow.length} currently running
            </p>
          </div>
        </div>
      </section>

      {/* Session List */}
      {loadingProgress ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: '#8B1538' }} /></div>
      ) : sessionsWithProgress.length === 0 ? (
        <div className="p-10 text-center" style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8D8DA' }}>
          <Radio className="w-10 h-10 mx-auto mb-3" style={{ color: '#E8D8DA' }} />
          <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '14px', color: '#6B4A50' }}>No sessions in scope.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessionsWithProgress.map((session) => {
            const badge = getStatusBadge(session.status);
            return (
              <div key={session.id} className="p-4 sm:p-5" style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8D8DA' }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ padding: '4px 10px', borderRadius: '8px', background: badge.bg, color: badge.color, fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      {badge.label}
                    </span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#6B4A50' }}>
                      {session.courseCode}
                    </span>
                  </div>
                  {session.status === 'open' && (
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#2d8a56', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2d8a56', animation: 'pulse 2s infinite' }} />
                      Live
                    </span>
                  )}
                </div>

                <h3 style={{ fontFamily: 'Gloock, serif', fontSize: '18px', color: '#1A0508', marginBottom: '4px' }}>
                  {session.courseName}
                </h3>
                <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', color: '#6B4A50', marginBottom: '2px' }}>
                  {session.lecturerName || 'N/A'}
                </p>
                <div className="flex flex-wrap items-center gap-4 mt-2" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', color: '#6B4A50' }}>
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{session.room || '—'}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{session.startTime || '—'}</span>
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{session.attendanceCount}/{session.enrolledCount}</span>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="w-full" style={{ background: '#F9E8EA', borderRadius: '9999px', height: '6px', overflow: 'hidden' }}>
                    <div style={{ width: `${session.progress}%`, height: '100%', background: session.status === 'open' ? '#2d8a56' : '#8B1538', borderRadius: '9999px', transition: 'width 600ms ease' }} />
                  </div>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#6B4A50', marginTop: '4px', display: 'block', textAlign: 'right' }}>
                    {session.progress}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

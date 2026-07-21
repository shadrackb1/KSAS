// OVERSIGHT TIER — READ-ONLY. No create, edit, or delete actions. All data is scoped read from Firestore.
import React, { useMemo, useState, useEffect } from 'react';
import { GraduationCap, AlertTriangle, ChevronDown, ChevronUp, Loader2, Award, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useFirestoreRealtimeCollection } from '../../hooks/useFirestoreRealtime';
import { db, collection, query, where, orderBy, limit, getDocs } from '../../lib/firebase';
import { collections } from '../../lib/db';

interface LecturerMetrics {
  uid: string;
  name: string;
  department: string;
  punctualityScore: number;
  noShowCount: number;
  lateStartCount: number;
  totalSessions: number;
}

interface SessionHist {
  id: string;
  date: string;
  startTime: string;
  courseCode: string;
  courseName: string;
  room: string;
  status: string;
  attendanceCount: number;
  enrolledCount: number;
}

export default function LecturerOversight() {
  const { user } = useAuth();

  const { data: users, loading: loadingUsers } = useFirestoreRealtimeCollection(collections.USERS);
  const { data: courses, loading: loadingCourses } = useFirestoreRealtimeCollection(collections.COURSES);
  const { data: sessions, loading: loadingSessions } = useFirestoreRealtimeCollection(collections.SESSIONS);

  const scopeFilter = user?.role === 'hod' ? 'department' : user?.role === 'dean' ? 'faculty' : null;
  const scopeValue = user ? (user as any)[scopeFilter || ''] : null;

  const scopeLecturers = useMemo<LecturerMetrics[]>(() => {
    const filteredUsers = users.filter((u: any) => {
      if (u.role !== 'lecturer') return false;
      if (!scopeFilter || !user) return true;
      return u[scopeFilter] === (user as any)[scopeFilter];
    });
    return filteredUsers.map((l: any) => {
      const lectSess = sessions.filter((s: any) => s.lecturerId === l.uid);
      const totalSessions = lectSess.length;
      let noShows = 0;
      let lateStarts = 0;
      lectSess.forEach((s: any) => {
        if (s.status === 'cancelled' || s.status === 'no-show') noShows++;
        if (s.startTime && s.scheduledStart && s.startTime > s.scheduledStart) lateStarts++;
      });
      const punctualityScore = totalSessions > 0 ? Math.round(((totalSessions - noShows - lateStarts) / totalSessions) * 100) : 100;
      return {
        uid: l.uid,
        name: l.name || 'Unnamed',
        department: l.department || 'Unassigned',
        punctualityScore,
        noShowCount: noShows,
        lateStartCount: lateStarts,
        totalSessions,
      };
    }).sort((a, b) => a.punctualityScore - b.punctualityScore);
  }, [users, sessions, scopeFilter, user]);

  const atRiskCount = useMemo(() => scopeLecturers.filter(l => l.punctualityScore < 85 || l.noShowCount > 3).length, [scopeLecturers]);

  const getScoreInfo = (score: number) => {
    if (score >= 95) return { bg: '#e8f5ed', color: '#2d8a56', label: 'Excellent' };
    if (score >= 85) return { bg: '#fef3cd', color: '#8a6d0f', label: 'Acceptable' };
    return { bg: '#fde8e8', color: '#8B1538', label: 'At Risk' };
  };

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, SessionHist[]>>({});
  const [loadingHist, setLoadingHist] = useState(false);

  const loadHistory = async (lecturerId: string) => {
    if (history[lecturerId]) return;
    setLoadingHist(true);
    try {
      const q = query(collection(db, collections.SESSIONS), where('lecturerId', '==', lecturerId), orderBy('date', 'desc'), limit(20));
      const snap = await getDocs(q);
      const records: SessionHist[] = snap.docs.map(d => {
        const dd: any = d.data();
        return {
          id: d.id,
          date: dd.date || '',
          startTime: dd.startTime || '',
          courseCode: dd.courseCode || '',
          courseName: dd.courseName || '',
          room: dd.room || '',
          status: dd.status || '',
          attendanceCount: dd.attendanceCount || 0,
          enrolledCount: dd.enrolledCount || 0,
        };
      });
      setHistory(prev => ({ ...prev, [lecturerId]: records }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHist(false);
    }
  };

  const handleToggle = (uid: string) => {
    setExpandedId(prev => prev === uid ? null : uid);
    if (expandedId !== uid) loadHistory(uid);
  };

  if (loadingUsers || loadingCourses || loadingSessions) {
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
          Lecturer Oversight
        </h1>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', color: '#6B4A50', fontWeight: 300 }}>
          Scope: {scopeValue || 'All'} · Read-Only
        </p>
      </section>

      {/* At Risk Alert */}
      {atRiskCount > 0 && (
        <section className="mb-6 p-4" style={{ background: '#fde8e8', borderRadius: '16px', border: '1px solid #f5c6c6' }}>
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: '#8B1538' }} />
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '14px', color: '#8B1538', fontWeight: 500 }}>
              {atRiskCount} lecturer{atRiskCount !== 1 ? 's' : ''} flagged as "At Risk" — punctuality below 85% or chronic no-shows.
            </p>
          </div>
        </section>
      )}

      {/* Summary Row */}
      <section className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        {[
          { label: 'Total Lecturers', value: scopeLecturers.length, color: '#8B1538' },
          { label: 'At Risk', value: atRiskCount, color: atRiskCount > 0 ? '#8B1538' : '#2d8a56' },
          { label: 'Avg Punctuality', value: `${scopeLecturers.length > 0 ? Math.round(scopeLecturers.reduce((s, l) => s + l.punctualityScore, 0) / scopeLecturers.length) : 0}%`, color: '#6B4A50' },
        ].map((stat) => (
          <div key={stat.label} className="p-3 sm:p-4 text-center" style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8D8DA' }}>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '24px', fontWeight: 500, color: stat.color }}>{stat.value}</p>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px', color: '#6B4A50', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '4px' }}>{stat.label}</p>
          </div>
        ))}
      </section>

      {/* Lecturer List */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8D8DA', overflow: 'hidden' }}>
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '12px 16px', fontFamily: 'Outfit, sans-serif', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B4A50', textAlign: 'left', borderBottom: '1px solid #E8D8DA' }}>Lecturer</th>
                <th style={{ padding: '12px 16px', fontFamily: 'Outfit, sans-serif', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B4A50', textAlign: 'left', borderBottom: '1px solid #E8D8DA' }}>Department</th>
                <th style={{ padding: '12px 16px', fontFamily: 'Outfit, sans-serif', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B4A50', textAlign: 'left', borderBottom: '1px solid #E8D8DA' }}>Sessions</th>
                <th style={{ padding: '12px 16px', fontFamily: 'Outfit, sans-serif', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B4A50', textAlign: 'left', borderBottom: '1px solid #E8D8DA' }}>Punctuality</th>
                <th style={{ padding: '12px 16px', fontFamily: 'Outfit, sans-serif', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B4A50', textAlign: 'left', borderBottom: '1px solid #E8D8DA' }}>No-Shows</th>
                <th style={{ padding: '12px 16px', fontFamily: 'Outfit, sans-serif', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B4A50', textAlign: 'left', borderBottom: '1px solid #E8D8DA' }}>Late Starts</th>
                <th style={{ padding: '12px 16px', fontFamily: 'Outfit, sans-serif', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B4A50', textAlign: 'center', borderBottom: '1px solid #E8D8DA' }}>History</th>
              </tr>
            </thead>
            <tbody>
              {scopeLecturers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center' }}>
                    <GraduationCap className="w-8 h-8 mx-auto mb-2" style={{ color: '#E8D8DA' }} />
                    <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '14px', color: '#6B4A50' }}>No lecturers in scope.</p>
                  </td>
                </tr>
              ) : scopeLecturers.map((lecturer) => {
                const scoreInfo = getScoreInfo(lecturer.punctualityScore);
                const isAtRisk = lecturer.punctualityScore < 85 || lecturer.noShowCount > 3;
                const isExpanded = expandedId === lecturer.uid;
                const hist = history[lecturer.uid] || [];
                return (
                  <React.Fragment key={lecturer.uid}>
                    <tr style={{ background: isExpanded ? '#FDF8F8' : 'transparent', borderBottom: '0.5px solid #E8D8DA' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center shrink-0" style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#F9E8EA' }}>
                            <GraduationCap className="w-4 h-4" style={{ color: '#8B1538' }} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontWeight: 600, color: '#1A0508' }}>{lecturer.name}</p>
                            {isAtRisk && (
                              <span className="inline-flex items-center gap-1" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#8B1538', fontWeight: 600, textTransform: 'uppercase' }}>
                                <AlertCircle className="w-3 h-3" /> At Risk
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', fontFamily: 'Outfit, sans-serif', fontSize: '13px', color: '#1A0508' }}>{lecturer.department}</td>
                      <td style={{ padding: '14px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: '#1A0508' }}>{lecturer.totalSessions}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '8px', background: scoreInfo.bg, color: scoreInfo.color, fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 600 }}>
                          {scoreInfo.label === 'Excellent' && <Award className="w-3.5 h-3.5" />}
                          {lecturer.punctualityScore}%
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: lecturer.noShowCount > 0 ? '#8B1538' : '#1A0508', fontWeight: lecturer.noShowCount > 0 ? 600 : 400 }}>{lecturer.noShowCount}</td>
                      <td style={{ padding: '14px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: lecturer.lateStartCount > 0 ? '#C9A84C' : '#1A0508', fontWeight: lecturer.lateStartCount > 0 ? 600 : 400 }}>{lecturer.lateStartCount}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleToggle(lecturer.uid)}
                          className="flex items-center justify-center gap-1 mx-auto transition-colors hover:bg-primary-container hover:border-primary/30 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
                          style={{ padding: '6px 14px', borderRadius: '8px', background: '#F9E8EA', border: '1px solid #E8D8DA', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: '12px', color: '#8B1538', fontWeight: 500 }}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          {isExpanded ? 'Hide' : 'History'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} style={{ padding: '16px', background: '#FDF8F8', borderBottom: '0.5px solid #E8D8DA' }}>
                          {loadingHist ? (
                            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" style={{ color: '#8B1538' }} /></div>
                          ) : hist.length === 0 ? (
                            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', color: '#6B4A50', textAlign: 'center' }}>No session history found.</p>
                          ) : (
                            <div>
                              <div className="grid grid-cols-6 gap-2 mb-2" style={{ padding: '0 8px' }}>
                                <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '10px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B4A50' }}>Date</span>
                                <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '10px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B4A50' }}>Course</span>
                                <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '10px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B4A50' }}>Room</span>
                                <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '10px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B4A50' }}>Status</span>
                                <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '10px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B4A50' }}>Time</span>
                                <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '10px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B4A50' }}>Attendance</span>
                              </div>
                              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                {hist.map((s: SessionHist) => {
                                  const pct = s.enrolledCount > 0 ? Math.round((s.attendanceCount / s.enrolledCount) * 100) : 0;
                                  const badge = getScoreInfo(pct >= 75 ? 100 : pct >= 50 ? 70 : 40);
                                  const statusBadge = s.status === 'open' ? { bg: '#e8f5ed', color: '#2d8a56', label: 'Active' } : s.status === 'closed' ? { bg: '#f0f0f0', color: '#6B4A50', label: 'Ended' } : s.status === 'cancelled' ? { bg: '#fde8e8', color: '#8B1538', label: 'Cancelled' } : { bg: '#fef3cd', color: '#8a6d0f', label: 'Scheduled' };
                                  return (
                                    <div key={s.id} className="grid grid-cols-6 gap-2 py-2.5" style={{ borderTop: '0.5px solid #E8D8DA', padding: '8px' }}>
                                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#1A0508' }}>{s.date}</span>
                                      <span>
                                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#8B1538', fontWeight: 600 }}>{s.courseCode}</span>
                                        <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', color: '#6B4A50', marginLeft: '4px' }}>{s.courseName}</span>
                                      </span>
                                      <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', color: '#6B4A50' }}>{s.room || '—'}</span>
                                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '6px', background: statusBadge.bg, color: statusBadge.color, fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>{statusBadge.label}</span>
                                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#6B4A50' }}>{s.startTime || '—'}</span>
                                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#1A0508' }}>{s.attendanceCount}/{s.enrolledCount} ({pct}%)</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

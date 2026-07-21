import React, { useMemo, useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
  import {
    Radio, StopCircle, QrCode, AlertCircle, FileBarChart, Calendar, Loader2, Bookmark,
    DownloadCloud, CheckCircle, X, TrendingUp, Star, Users, BookOpen, ChevronDown,
  } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  DonutChart, RadialRing, ATTENDANCE_COLORS, CountUp, Sparkline,
} from '../../components/charts';
import { useAuth } from '../../hooks/useAuth';
import { useFirestoreRealtimeCollection } from '../../hooks/useFirestoreRealtime';
import { db, collection, addDoc, serverTimestamp, doc, updateDoc, onSnapshot, getDocs, query, where } from '../../lib/firebase';
import { collections, archiveSession } from '../../lib/db';
import { generateSessionTOTPSecret } from '../../lib/totp';
import { exportSessionCSV, buildAttendanceCsv, formatTimestampExact } from '../../lib/csvExport';
import { CAMPUSES, type CampusConfig } from '../../lib/campuses';

export default function LecturerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: allSessions, loading: loadingSessions } = useFirestoreRealtimeCollection(collections.SESSIONS);
  const { data: allCourses } = useFirestoreRealtimeCollection(collections.COURSES);
  const { data: allEnrollments } = useFirestoreRealtimeCollection(collections.ENROLLMENTS);

  const myCourses = useMemo(() => {
    return (allCourses || []).filter((c: any) => c.lecturer === user?.uid);
  }, [allCourses, user]);

  const myEnrollments = useMemo(() => {
    const myCourseCodes = new Set(myCourses.map(c => c.code));
    return (allEnrollments || []).filter((e: any) => myCourseCodes.has(e.courseCode));
  }, [allEnrollments, myCourses]);

  const enrollmentsByCourse = useMemo(() => {
    const grouped = new Map<string, { code: string; name: string; students: typeof myEnrollments }>();
    for (const c of myCourses) {
      grouped.set(c.code, { code: c.code, name: c.name, students: [] });
    }
    for (const e of myEnrollments) {
      const group = grouped.get(e.courseCode);
      if (group) group.students.push(e);
    }
    return Array.from(grouped.values()).filter(g => g.students.length > 0);
  }, [myCourses, myEnrollments]);

  const activeSession = useMemo(() => {
    return (allSessions || []).find((s: any) => s.lecturerId === user?.uid && s.status === 'open');
  }, [allSessions, user]);

  const [starting, setStarting] = useState(false);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [ending, setEnding] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [endResult, setEndResult] = useState<{ session: any; attendance: any[] } | null>(null);
  const [selectedCampusId, setSelectedCampusId] = useState<string>('');
  const [showTopicDropdown, setShowTopicDropdown] = useState(false);
  const [selectedCourseCode, setSelectedCourseCode] = useState('');
  const topicInputRef = useRef<HTMLInputElement>(null);

  const selectedCourse = useMemo(() => {
    if (!selectedCourseCode) return null;
    return (allCourses || []).find((c: any) => c.code === selectedCourseCode) || null;
  }, [selectedCourseCode, allCourses]);

  useEffect(() => {
    if (!activeSession?.id) { setAttendanceCount(0); return; }
    const attCollRef = collection(db, `${collections.SESSIONS}/${activeSession.id}/attendance`);
    const unsubscribe = onSnapshot(attCollRef, (snapshot) => {
      setAttendanceCount(snapshot.docs.length);
    }, (error) => {
      console.error('Attendance count listener error:', error);
    });
    return () => unsubscribe();
  }, [activeSession?.id]);

  const handleCourseSelect = (code: string) => {
    setSelectedCourseCode(code);
    setShowTopicDropdown(false);
    const course = (allCourses || []).find((c: any) => c.code === code);
    if (!course) return;
    const form = document.querySelector('form[name="sessionForm"]') as HTMLFormElement | null;
    if (!form) return;
    const setField = (name: string, value: string) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | null;
      if (el) { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
    };
    setField('name', course.name || '');
    if (course.defaultRoom) setField('room', course.defaultRoom);
    if (course.defaultStartTime) setField('startTime', course.defaultStartTime);
    if (course.defaultEndTime) setField('endTime', course.defaultEndTime);
  const antiFraudDefaults = course.antiFraudDefaults;
  if (antiFraudDefaults) {
      if (antiFraudDefaults.requireGps !== undefined) {
        const gps = form.elements.namedItem('requireGps') as HTMLInputElement | null;
        if (gps) gps.checked = antiFraudDefaults.requireGps;
      }
      if (antiFraudDefaults.requireIpRange !== undefined) {
        const ip = form.elements.namedItem('requireIpRange') as HTMLInputElement | null;
        if (ip) ip.checked = antiFraudDefaults.requireIpRange;
      }
      if (antiFraudDefaults.allowedRadiusMeters) {
        setField('allowedRadiusMeters', String(antiFraudDefaults.allowedRadiusMeters));
      }
    }
    if (course.defaultCampusId) {
      setSelectedCampusId(course.defaultCampusId);
      const campus = CAMPUSES.find((c: any) => c.id === course.defaultCampusId);
      if (campus) {
        setField('campusLat', String(campus.latitude));
        setField('campusLng', String(campus.longitude));
        setField('allowedRadiusMeters', String(campus.defaultRadiusMeters));
      }
    }
  };

  const handleCampusChange = (campusId: string) => {
    setSelectedCampusId(campusId);
    const campus = CAMPUSES.find((c: any) => c.id === campusId);
    if (!campus) return;
    const form = document.querySelector('form[name="sessionForm"]') as HTMLFormElement;
    if (!form) return;
    const setField = (name: string, value: string) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | null;
      if (el) { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
    };
    setField('campusLat', String(campus.latitude));
    setField('campusLng', String(campus.longitude));
    setField('allowedRadiusMeters', String(campus.defaultRadiusMeters));
    const gpsCheck = form.elements.namedItem('requireGps') as HTMLInputElement | null;
    if (gpsCheck) gpsCheck.checked = campus.antiFraud.gpsProximityCheck;
    const ipCheck = form.elements.namedItem('requireIpRange') as HTMLInputElement | null;
    if (ipCheck) ipCheck.checked = campus.antiFraud.ipValidation;
  };

  const handleStartSession = async (courseCode: string, courseName: string, room: string, topicOfDay: string = '', startTime?: string, endTime?: string, securityConfig?: {
    requireGps?: boolean;
    requireIpRange?: boolean;
    campusLat?: number;
    campusLng?: number;
    allowedRadiusMeters?: number;
  }) => {
    setStarting(true);
    try {
      const secret = generateSessionTOTPSecret();
      const dateStr = new Date().toISOString().split('T')[0];
      let enrolledCount = 0;
      try {
        const enrollQ = query(collection(db, collections.ENROLLMENTS), where('courseCode', '==', courseCode));
        const enrollSnap = await getDocs(enrollQ);
        enrolledCount = enrollSnap.size;
      } catch { enrolledCount = 0; }
      const now = new Date();
      const start = startTime || now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const end = endTime || new Date(now.getTime() + 2 * 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const newSessionRef = await addDoc(collection(db, collections.SESSIONS), {
  courseCode,
  courseName,
  lecturerId: user?.uid,
  lecturerName: user?.name || 'Lecturer',
  room,
  date: dateStr,
  startTime: start,
  endTime: end,
  windowMinutes: 15,
  status: 'open',
  totpSecret: secret,
  enrolledCount,
  startedAt: serverTimestamp(),
  createdAt: serverTimestamp(),
  topicOfDay,
  requireGps: securityConfig?.requireGps || false,
  requireIpRange: securityConfig?.requireIpRange || false,
  campusLat: securityConfig?.campusLat,
  campusLng: securityConfig?.campusLng,
  allowedRadiusMeters: securityConfig?.allowedRadiusMeters || 500,
});
      navigate(`/lecturer/live?sessionId=${newSessionRef.id}`);
    } catch (err) {
      console.error('Failed to start session', err);
      toast.error('Failed to start session.');
    } finally {
      setStarting(false);
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    setShowEndConfirm(true);
  };

const confirmEndSession = async () => {
  if (!activeSession || ending) return;
  setEnding(true);
  try {
    const attCollRef = collection(db, `${collections.SESSIONS}/${activeSession.id}/attendance`);
    const snapshot = await getDocs(attCollRef);
    const records = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const archiveRows = records.map((r: any) => {
      const ts = formatTimestampExact(r.timestamp);
      return {
        studentId: r.studentId || '',
        studentName: r.studentName || '',
        studentEmail: r.studentEmail || '',
        regNumber: r.studentId || '',
        status: r.status || 'present',
        date: ts.date,
        timeIn: ts.time,
        courseCode: activeSession.courseCode || '',
        courseName: activeSession.courseName || '',
        room: activeSession.room || '',
        lecturerName: activeSession.lecturerName || '',
        topicOfDay: activeSession.topicOfDay || '',
        deviceFingerprint: r.deviceFingerprint || '',
      };
    });
    const csvStr = buildAttendanceCsv(archiveRows);
    await updateDoc(doc(db, collections.SESSIONS, activeSession.id), {
      status: 'closed',
      endedAt: serverTimestamp(),
    });
    await archiveSession(activeSession.id, csvStr);
    setEndResult({ session: { ...activeSession, id: activeSession.id }, attendance: records });
    setShowEndConfirm(false);
  } catch (err) {
    console.error('Failed to end session', err);
    toast.error('Failed to end session.');
  } finally {
    setEnding(false);
  }
};

  const handleDownloadCsv = () => {
    if (!endResult) return;
    exportSessionCSV(endResult.session, endResult.attendance);
  };

  const [weeklyTrendData, setWeeklyTrendData] = useState<{ day: string; pct: number }[]>([]);
  const [weeklyTrendLoading, setWeeklyTrendLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const lecturerSessions = (allSessions || []).filter((s: any) => s.lecturerId === user?.uid);
        const dayCount: Record<string, { present: number; enrolled: number }> = {};
        dayNames.forEach(d => { dayCount[d] = { present: 0, enrolled: 0 }; });
        for (const s of lecturerSessions) {
          if (!s.date) continue;
          const d = new Date(s.date);
          if (isNaN(d.getTime())) continue;
          const day = dayNames[d.getDay()];
          const enrolled = s.enrolledCount || 0;
          dayCount[day].enrolled += enrolled;
          if (s.attendanceCount != null && s.attendanceCount > 0) {
            dayCount[day].present += s.attendanceCount;
          } else if (enrolled > 0 && s.status === 'open') {
            try {
              const attSnap = await getDocs(collection(db, `${collections.SESSIONS}/${s.id}/attendance`));
              dayCount[day].present += attSnap.size;
            } catch { /* skip */ }
          }
        }
        if (cancelled) return;
        const trend = dayNames.filter(d => d !== 'Sun' && d !== 'Sat').map(day => {
          const { present, enrolled } = dayCount[day];
          return { day, pct: enrolled > 0 ? Math.round((present / enrolled) * 100) : 0 };
        });
        setWeeklyTrendData(trend);
      } catch {
        if (!cancelled) {
          const fallback = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => ({ day, pct: 0 }));
          setWeeklyTrendData(fallback);
        }
      } finally {
        if (!cancelled) setWeeklyTrendLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [allSessions, user]);

  const weeklyTrend = weeklyTrendData;
  const weeklyAvg = useMemo(() => {
    const vals = weeklyTrend.filter(d => d.pct > 0);
    if (vals.length === 0) return 0;
    return Math.round(vals.reduce((s, d) => s + d.pct, 0) / vals.length);
  }, [weeklyTrend]);

  if (loadingSessions) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--kabu-maroon)' }} />
      </div>
    );
  }

  const enrolledCount = activeSession?.enrolledCount || 0;
  const attendancePct = enrolledCount > 0 ? Math.min(100, Math.round((attendanceCount / enrolledCount) * 100)) : 0;
  const outlineTopics = selectedCourse?.outline || [];

  return (
    <div className="animate-page-in" style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 48px' }}>
      <div className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-editorial)', fontSize: '28px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          Welcome back, {user?.name || 'Lecturer'}
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 300, fontStyle: 'italic' }}>
          Education in Biblical Perspective · {user?.department || 'Lecturer'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Active Session / Start Session Panel */}
        <div className="md:col-span-12 relative overflow-hidden" style={{
          minHeight: '320px',
          padding: '24px',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '0.5px solid var(--bg-border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
          maxWidth: '720px',
          margin: '0 auto',
        }}>
          {activeSession ? (
            <>
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--success)' }}></span>
                      <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: 'var(--success)' }}></span>
                    </span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                      Session Live
                    </span>
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                    {activeSession.courseName}
                    <span className="font-normal ml-2" style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: 'var(--text-secondary)' }}>
                      ({activeSession.courseCode})
                    </span>
                  </h2>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Room: {activeSession.room} · Started {activeSession.startTime}
                  </p>
                  {/* Attendance stats */}
                  <div className="grid grid-cols-4 gap-4 mt-6">
                    <div className="p-4 text-center" style={{ background: 'var(--success-bg)', borderRadius: 'var(--radius-md)' }}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, color: 'var(--success)' }}>
                        <CountUp value={attendanceCount} />
                      </p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginTop: '4px' }}>Present</p>
                    </div>
                    <div className="p-4 text-center" style={{ background: 'var(--danger-bg)', borderRadius: 'var(--radius-md)' }}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, color: 'var(--danger)' }}>
                        <CountUp value={Math.max(0, enrolledCount - attendanceCount)} />
                      </p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginTop: '4px' }}>Absent</p>
                    </div>
                    <div className="p-4 text-center flex items-center justify-center" style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                      <div className="flex flex-col items-center">
                        <RadialRing
                          value={attendancePct}
                          size={80}
                          thickness={8}
                          color={attendancePct >= 75 ? 'var(--success)' : attendancePct >= 50 ? 'var(--warning)' : 'var(--danger)'}
                          sublabel="Rate"
                        />
                      </div>
                    </div>
                    <div className="p-4 text-center" style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{attendanceCount} / {enrolledCount}</p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Checked in</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 mt-6">
                  <button onClick={handleEndSession} className="btn-danger px-6 py-3 text-sm">
                    <StopCircle className="w-4 h-4" /> End Session
                  </button>
                  <button onClick={() => navigate(`/lecturer/live?sessionId=${activeSession.id}`)} className="btn-ghost px-6 py-3 text-sm flex items-center gap-2">
                    <QrCode className="w-4 h-4" /> Show QR & Attendance
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '16px' }}>
                Start New Session
              </h3>
              <form name="sessionForm" onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const securityConfig = {
                  requireGps: fd.get('requireGps') === 'on',
                  requireIpRange: fd.get('requireIpRange') === 'on',
                  campusLat: fd.get('campusLat') ? parseFloat(fd.get('campusLat') as string) : undefined,
                  campusLng: fd.get('campusLng') ? parseFloat(fd.get('campusLng') as string) : undefined,
                  allowedRadiusMeters: fd.get('allowedRadiusMeters') ? parseInt(fd.get('allowedRadiusMeters') as string) : 500,
                };
                handleStartSession(
                  fd.get('code') as string,
                  fd.get('name') as string,
                  fd.get('room') as string,
                  (fd.get('topic') as string) || '',
                  fd.get('startTime') as string || undefined,
                  fd.get('endTime') as string || undefined,
                  securityConfig
                );
              }} className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
  <div className="form-group">
    <label className="form-label">Course Code</label>
    <input name="code" required list="courses-list" onChange={(e) => handleCourseSelect(e.target.value)} className="input-base" placeholder="Type or select a course..." />
    <datalist id="courses-list">
      {myCourses.map((c: any) => (
        <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
      ))}
    </datalist>
  </div>
  <div className="form-group">
    <label className="form-label">Room / Venue</label>
    <input name="room" required placeholder={selectedCourse?.defaultRoom || 'e.g. Room 104'} className="input-base" />
  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Course Name</label>
                  <input name="name" required placeholder={selectedCourse?.name || 'e.g. Data Structures & Algorithms'} className="input-base" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Start Time</label>
                    <input name="startTime" type="time" required defaultValue={selectedCourse?.defaultStartTime || '08:00'} className="input-base" style={{ fontFamily: 'var(--font-mono)', fontSize: '14px' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Time</label>
                    <input name="endTime" type="time" required defaultValue={selectedCourse?.defaultEndTime || '10:00'} className="input-base" style={{ fontFamily: 'var(--font-mono)', fontSize: '14px' }} />
                  </div>
                </div>
                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label">Topic of Day</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      ref={topicInputRef}
                      name="topic"
                      maxLength={120}
                      placeholder={selectedCourse && outlineTopics.length > 0 ? 'Select from outline or type custom...' : 'e.g. Constitutional Law — Chapter 3'}
                      className="input-base"
                      style={{ paddingRight: '36px' }}
                      onFocus={() => { if (outlineTopics.length > 0) setShowTopicDropdown(true); }}
                      onChange={(e) => {
                        const next = e.currentTarget.nextElementSibling;
                        if (next) next.textContent = `${e.target.value.length} / 120`;
                      }}
                    />
                    {outlineTopics.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowTopicDropdown(v => !v)}
                        style={{
                          position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
                          padding: '4px', display: 'flex', alignItems: 'center',
                        }}
                      >
                        <BookOpen className="w-4 h-4" />
                      </button>
                    )}
                    {showTopicDropdown && outlineTopics.length > 0 && (
                      <div
                        style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                          background: 'var(--bg-void)', border: '0.5px solid var(--bg-border)',
                          borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                          maxHeight: '200px', overflowY: 'auto', marginTop: '4px',
                        }}
                      >
                        <div
                          style={{
                            padding: '10px 14px',
                            fontSize: '11px',
                            fontWeight: 500,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            color: 'var(--text-tertiary)',
                            borderBottom: '0.5px solid var(--bg-border)',
                            position: 'sticky', top: 0,
                            background: 'var(--bg-void)',
                          }}
                        >
                          <BookOpen className="w-3.5 h-3.5 inline" style={{ marginRight: '6px' }} />
                          Course Outline — {outlineTopics.length} topics
                        </div>
                        {outlineTopics.map((topic: string, idx: number) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (topicInputRef.current) {
                                topicInputRef.current.value = topic;
                                topicInputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
                                const next = topicInputRef.current.nextElementSibling;
                                if (next) next.textContent = `${topic.length} / 120`;
                              }
                              setShowTopicDropdown(false);
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '10px 14px',
                              background: 'none',
                              border: 'none',
                              borderBottom: '0.5px solid var(--bg-border)',
                              cursor: 'pointer',
                              fontFamily: 'var(--font-body)',
                              fontSize: '13px',
                              color: 'var(--text-primary)',
                              transition: 'background 150ms',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                          >
                            <span style={{ color: 'var(--kabu-maroon)', fontWeight: 600, marginRight: '8px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                              W{idx + 1}
                            </span>
                            {topic}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'right', marginTop: '4px' }}>0 / 120</div>
                </div>

                {/* Campus Selector */}
                <div className="form-group">
                  <label className="form-label">Campus</label>
                  <select name="campusId" value={selectedCampusId} onChange={(e) => handleCampusChange(e.target.value)} className="input-base cursor-pointer" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '14px' }}>
                    <option value="">Select a campus...</option>
                    {CAMPUSES.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                    GPS coordinates, radius, and anti-fraud settings auto-fill on selection.
                  </p>
                </div>

                {/* Security Settings */}
                <div className="p-4 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4" style={{ color: 'var(--kabu-maroon)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                    <span className="font-label-md" style={{ color: 'var(--text-secondary)' }}>Anti-Fraud Security</span>
                  </div>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>GPS Proximity Check</span>
                      <input type="checkbox" name="requireGps" className="w-4 h-4" style={{ accentColor: 'var(--kabu-maroon)' }} />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>IP Range Validation</span>
                      <input type="checkbox" name="requireIpRange" className="w-4 h-4" style={{ accentColor: 'var(--kabu-maroon)' }} />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Campus Latitude</label>
                        <input name="campusLat" type="number" step="any" placeholder="-0.3031" className="input-base" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }} />
                      </div>
                      <div>
                        <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Campus Longitude</label>
                        <input name="campusLng" type="number" step="any" placeholder="35.9403" className="input-base" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Allowed Radius (meters)</label>
                      <input name="allowedRadiusMeters" type="number" min="50" max="2000" defaultValue="500" className="input-base" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }} />
                    </div>
                  </div>
                  <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Device binding + token consumption are always enabled. GPS and IP checks are optional.
                  </p>
                </div>
                <button type="submit" disabled={starting} className="btn-primary w-full h-12 text-sm disabled:opacity-60">
                  {starting ? (<><Loader2 className="w-4 h-4 animate-spin" /> Starting...</>) : (<><Radio className="w-4 h-4" /> Start Session</>)}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Quick Actions */}
        <div className="md:col-span-12" style={{
          padding: '16px 24px',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '0.5px solid var(--bg-border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
        }}>
          <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '16px', color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '12px' }}>
            Quick Actions
          </h3>
          <div className="flex flex-wrap gap-3">
            {[
              { icon: AlertCircle, label: 'Notify Absentees', bg: 'var(--kabu-maroon-tint)', color: 'var(--kabu-maroon)', onClick: () => { if (!activeSession) { toast('No active session to notify absentees from.', { icon: '📋' }); return; } toast.success('Absentee notifications queued for ' + activeSession.courseCode); } },
              { icon: FileBarChart, label: 'Generate Report', bg: 'var(--bg-elevated)', color: 'var(--text-secondary)', onClick: () => navigate('/lecturer/reports') },
              { icon: Calendar, label: 'Schedule', bg: 'var(--success-bg)', color: 'var(--success)', onClick: () => toast('Session scheduling coming soon.', { icon: '📅' }) },
              { icon: AlertCircle, label: 'Risk Monitor', bg: 'var(--danger-bg)', color: 'var(--danger)', onClick: () => navigate('/lecturer/risk') },
            ].map((action) => (
              <button key={action.label} onClick={action.onClick} className="flex items-center gap-3 px-4 py-3 text-center transition-colors flex-1 min-w-[140px]" style={{
                background: action.bg, border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer',
              }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--bg-surface)' }}>
                  <action.icon className="w-5 h-5" style={{ color: action.color }} />
                </div>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)', textAlign: 'left' }}>
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Weekly Trend */}
        <div className="md:col-span-12 flex flex-col" style={{
          padding: '24px',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '0.5px solid var(--bg-border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
        }}>
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Weekly Attendance Trend</h3>
            <span className="badge badge-success">Avg: {weeklyAvg}%</span>
          </div>
          <div className="flex items-end space-x-2 relative pt-4" style={{ minHeight: '120px' }}>
            {weeklyTrend.map(({ day, pct }) => (
              <div key={day} className="flex-1 flex flex-col items-center justify-end h-full">
                <div className="w-full rounded-t-md transition-colors cursor-pointer" style={{
                  maxWidth: '48px', height: `${Math.max(pct, 4)}%`, minHeight: '8px',
                  background: 'var(--kabu-maroon)', opacity: 0.3,
                }} onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.3'; }} title={`${day}: ${pct}%`} />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginTop: '8px' }}>{day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Attendance Analytics */}
        <AnalyticsSection sessions={allSessions} userId={user?.uid} />

        {/* Enrolled Students */}
        {enrollmentsByCourse.length > 0 && (
          <div className="md:col-span-12" style={{
            padding: '24px',
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '0.5px solid var(--bg-border)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
          }}>
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5" style={{ color: 'var(--kabu-maroon)' }} />
              <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Enrolled Students</h3>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-tertiary)', marginLeft: '8px' }}>
                {myEnrollments.length} total across {enrollmentsByCourse.length} course{enrollmentsByCourse.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-4">
              {enrollmentsByCourse.map((group) => (
                <div key={group.code} style={{
                  padding: '16px',
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-md)',
                  border: '0.5px solid var(--bg-border)',
                }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 500, color: 'var(--kabu-maroon)' }}>{group.code}</span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)' }}>{group.name}</span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-tertiary)' }}>{group.students.length} students</span>
                  </div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', textAlign: 'left', padding: '6px 8px', borderBottom: '0.5px solid var(--bg-border)' }}>Student</th>
                          <th style={{ fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', textAlign: 'left', padding: '6px 8px', borderBottom: '0.5px solid var(--bg-border)' }}>ID</th>
                          <th style={{ fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', textAlign: 'left', padding: '6px 8px', borderBottom: '0.5px solid var(--bg-border)' }}>Enrolled</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.students.map((e) => (
                          <tr key={e.id} style={{ borderBottom: '0.5px solid var(--bg-border)' }}>
                            <td style={{ padding: '8px', fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-primary)' }}>{e.studentName || '—'}</td>
                            <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>{e.studentId}</td>
                            <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                              {e.enrolledAt ? new Date(e.enrolledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* End Session Confirmation Modal */}
      {showEndConfirm && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={() => { if (!ending) setShowEndConfirm(false); }}>
          <div className="w-full max-w-md animate-scale-in" style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-xl)', padding: '32px' }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-full)', background: 'var(--danger-bg)', border: '0.5px solid var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <StopCircle className="w-5 h-5" style={{ color: 'var(--danger)' }} />
              </div>
              <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '22px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>End Session</h3>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                This will close {activeSession?.courseName}. Attendance data will be archived and a CSV download will be offered.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowEndConfirm(false)} disabled={ending} className="btn-ghost flex-1">Cancel</button>
              <button onClick={confirmEndSession} disabled={ending} className="btn-danger flex-1">
                {ending ? <><Loader2 className="w-4 h-4 animate-spin" /> Ending…</> : 'End Session'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* End Session Success Modal */}
      {endResult && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={() => setEndResult(null)}>
          <div className="w-full max-w-md animate-scale-in" style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-xl)', padding: '32px' }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-full)', background: 'var(--success-bg)', border: '0.5px solid var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckCircle className="w-5 h-5" style={{ color: 'var(--success)' }} />
              </div>
              <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '22px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Session ended</h3>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                {endResult.session.courseName} &nbsp;·&nbsp; {endResult.session.date && new Date(endResult.session.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} &nbsp;·&nbsp; {endResult.attendance.length} students
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={handleDownloadCsv} className="btn-primary w-full flex items-center justify-center gap-2" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '14px', fontWeight: 500, padding: '10px 20px' }}>
                <DownloadCloud className="w-4 h-4" /> Download Attendance CSV
              </button>
              <button onClick={() => setEndResult(null)} className="btn-ghost w-full">Back to Dashboard</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function AnalyticsSection({ sessions, userId }: { sessions: any[]; userId?: string }) {
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoadingFeedback(true);
      try {
        const q = query(collection(db, collections.FEEDBACK), where('lecturerId', '==', userId));
        const snap = await getDocs(q);
        setFeedbackList(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => {
          const ta = a.createdAt?.toMillis?.() || 0;
          const tb = b.createdAt?.toMillis?.() || 0;
          return tb - ta;
        }));
      } catch { setFeedbackList([]); }
      finally { setLoadingFeedback(false); }
    })();
  }, [userId]);

  const mySessions = useMemo(() => (sessions || []).filter((s: any) => s.lecturerId === userId), [sessions, userId]);

  const courseStats = useMemo(() => {
    const map = new Map<string, { total: number; present: number; name: string; rates: number[] }>();
    mySessions.forEach((s: any) => {
      if (!s.courseCode) return;
      const existing = map.get(s.courseCode);
      const p = s.enrolledCount || 50;
      const rate = p > 0 ? Math.round(((s.attendanceCount || 0) / p) * 100) : 0;
      if (existing) { existing.total += p; existing.present += s.attendanceCount || 0; existing.rates.push(rate); }
      else map.set(s.courseCode, { total: p, present: s.attendanceCount || 0, name: s.courseName || s.courseCode, rates: [rate] });
    });
    return Array.from(map.entries()).map(([code, v]) => ({
      course: code, name: v.name, rate: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0, present: v.present, total: v.total,
      rates: v.rates,
    })).sort((a, b) => a.rate - b.rate);
  }, [mySessions]);

  const attendanceStatusBreakdown = useMemo(() => {
    let present = 0; let late = 0; let absent = 0;
    mySessions.forEach((s: any) => {
      if (s.attendancePresent != null) present += s.attendancePresent;
      if (s.attendanceLate != null) late += s.attendanceLate;
      if (s.attendanceAbsent != null) absent += s.attendanceAbsent;
    });
    if (present === 0 && late === 0 && absent === 0) return [];
    return [
      { name: 'Present', value: present, color: 'var(--success)' },
      { name: 'Late', value: late, color: 'var(--warning)' },
      { name: 'Absent', value: absent, color: 'var(--danger)' },
    ].filter(d => d.value > 0);
  }, [mySessions]);

  const recentSessions = useMemo(() => {
    return [...mySessions].filter((s: any) => s.status === 'closed').sort((a: any, b: any) => {
      if (a.date < b.date) return 1;
      if (a.date > b.date) return -1;
      return 0;
    }).slice(0, 10);
  }, [mySessions]);

  const totalSessions = mySessions.length;
  const avgRate = courseStats.length > 0 ? Math.round(courseStats.reduce((s, c) => s + c.rate, 0) / courseStats.length) : 0;

  const avgFeedbackScore = useMemo(() => {
    if (feedbackList.length === 0) return 0;
    return Math.round((feedbackList.reduce((s, f) => s + (f.rating || 0), 0) / feedbackList.length) * 10) / 10;
  }, [feedbackList]);

  const universityAvgRate = useMemo(() => {
    if (!sessions || sessions.length === 0) return 0;
    let totalRate = 0; let count = 0;
    for (const s of sessions) {
      const enrolled = s.enrolledCount || 0;
      if (enrolled === 0) continue;
      const attended = s.attendanceCount || 0;
      totalRate += Math.min(100, Math.round((attended / enrolled) * 100));
      count++;
    }
    return count > 0 ? Math.round(totalRate / count) : 0;
  }, [sessions]);

  const effectivenessScore = useMemo(() => {
    if (totalSessions === 0) return 0;
    const attendanceComponent = avgRate * 0.6;
    const feedbackComponent = (avgFeedbackScore / 5) * 100 * 0.3;
    const consistencyComponent = courseStats.length > 0 ? Math.min(100, courseStats.length * 20) * 0.1 : 0;
    return Math.round(attendanceComponent + feedbackComponent + consistencyComponent);
  }, [avgRate, avgFeedbackScore, courseStats, totalSessions]);

  const getRateColor = (rate: number) => {
    if (rate >= 75) return 'var(--success)';
    if (rate >= 50) return 'var(--warning)';
    return 'var(--danger)';
  };

  const chartTooltipStyle = {
    background: 'var(--bg-elevated)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-md)',
    fontSize: '13px', fontFamily: 'Outfit, sans-serif',
  };

  if (mySessions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)' }}>
        <TrendingUp className="w-8 h-8 mx-auto mb-2" style={{ opacity: 0.5 }} />
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px' }}>No session data yet. Start a session to see analytics.</p>
      </div>
    );
  }

  return (
    <div className="md:col-span-12">
      {/* Mini stat row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', textAlign: 'center', overflow: 'hidden' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
            <CountUp value={totalSessions} />
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '4px', whiteSpace: 'nowrap' }}>Sessions</p>
        </div>
        <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', textAlign: 'center', overflow: 'hidden' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
            <CountUp value={courseStats.length} />
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '4px', whiteSpace: 'nowrap' }}>Courses</p>
        </div>
        <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', textAlign: 'center', overflow: 'hidden' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, color: getRateColor(avgRate), whiteSpace: 'nowrap' }}>
            <CountUp value={avgRate} suffix="%" />
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '4px', whiteSpace: 'nowrap' }}>Avg Rate</p>
        </div>
      </div>

      {/* Attendance Status Donut */}
      {attendanceStatusBreakdown.length > 0 && (
        <div className="mb-6" style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '16px', textAlign: 'center' }}>
          <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Attendance Breakdown</h4>
          <div className="flex justify-center">
            <DonutChart data={attendanceStatusBreakdown} size={200} innerRadius={60} outerRadius={85} />
          </div>
        </div>
      )}

      {/* Effectiveness Metrics */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Your Avg Feedback</p>
          <div className="flex items-center justify-center gap-1 mt-2">
            <Star className="w-5 h-5" style={{ fill: 'var(--kabu-gold)', color: 'var(--kabu-gold)' }} />
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', color: 'var(--kabu-gold)', fontWeight: 500 }}>
              {avgFeedbackScore > 0 ? <CountUp value={avgFeedbackScore} decimals={1} /> : '—'}
            </p>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-tertiary)' }}>/5</span>
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{feedbackList.length} reviews</p>
        </div>
        <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>vs University Avg</p>
          <p className="mt-2" style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, color: avgRate >= universityAvgRate ? 'var(--success)' : 'var(--warning)' }}>
            {avgRate >= universityAvgRate ? '+' : ''}<CountUp value={avgRate - universityAvgRate} suffix="%" />
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            Uni avg: {universityAvgRate}%
          </p>
        </div>
        <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Effectiveness Score</p>
          <p className="mt-2" style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, color: getRateColor(effectivenessScore) }}>
            <CountUp value={effectivenessScore} />
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            {effectivenessScore >= 75 ? 'Excellent' : effectivenessScore >= 50 ? 'Good' : 'Needs work'}
          </p>
        </div>
      </div>

      {/* Course Performance Chart */}
      {courseStats.length > 0 && (
        <div style={{ padding: '20px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
          <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Course Performance</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={courseStats} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" vertical={false} />
              <XAxis dataKey="course" tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} tickLine={false} axisLine={{ stroke: 'var(--bg-border)' }} />
              <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'Outfit, sans-serif' }} tickLine={false} axisLine={{ stroke: 'var(--bg-border)' }} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(value: any) => [`${value}%`, 'Attendance']} />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                {courseStats.map((entry) => (
                  <Cell key={entry.course} fill={entry.rate >= 75 ? 'var(--success)' : entry.rate >= 50 ? 'var(--kabu-gold)' : 'var(--danger)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Course sparkline table */}
          <div className="mt-4 space-y-2">
            {courseStats.map((c) => (
              <div key={c.course} className="flex items-center justify-between gap-3">
                <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px', color: 'var(--text-primary)' }}>{c.course}</span>
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: c.rate >= 75 ? 'var(--success)' : c.rate >= 50 ? 'var(--warning)' : 'var(--danger)', fontWeight: 500 }}>{c.rate}%</span>
                  {c.rates && c.rates.length >= 2 && <Sparkline data={c.rates} color={c.rate >= 75 ? 'var(--success)' : c.rate >= 50 ? 'var(--warning)' : 'var(--danger)'} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <div style={{ padding: '20px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Recent Sessions</h4>
          <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
            {recentSessions.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between py-3" style={{ borderBottom: '0.5px solid var(--bg-border)' }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{s.courseName}</p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>{s.courseCode} · {s.date}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 500, color: getRateColor(s.enrolledCount > 0 ? Math.round((s.attendanceCount || 0) / s.enrolledCount * 100) : 0) }}>
                    {s.enrolledCount > 0 ? Math.round((s.attendanceCount || 0) / s.enrolledCount * 100) : 0}%
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)' }}>{s.attendanceCount || 0}/{s.enrolledCount}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

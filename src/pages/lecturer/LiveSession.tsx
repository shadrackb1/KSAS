/**
 * src/pages/lecturer/LiveSession.tsx
 * Live session management with 5-second QR refresh display.
 *
 * TOTP strategy:
 *  - Secret stored in session doc (unchanged)
 *  - TOTP period = 5s → token changes every QR refresh
 *  - UI countdown resets every 5s for visual security signal
 *  - Each QR refresh embeds a fresh TOTP token to prevent screenshot sharing
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  Users, CheckCircle, Loader2, Clock, AlertCircle,
  Wifi, WifiOff, RefreshCw, RotateCcw, Download, Bookmark,
  Shield, MapPin, Globe, Smartphone, Search, UserCheck, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { db, doc, collection, onSnapshot, updateDoc, getDocs, query, where } from '../../lib/firebase';
import { collections, archiveSession, closeSession, markManualAttendance } from '../../lib/db';
import { getCurrentTOTP } from '../../lib/totp';
import { buildAttendanceCsv, downloadCsv, formatTimeIn, formatTimestampExact, AttendanceCsvRow } from '../../lib/csvExport';

const QR_DISPLAY_INTERVAL_MS = 5_000;
const TOTP_PERIOD_S = 5;

export default function LiveSession() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('sessionId');
  const { user } = useAuth();

  const [sessionData, setSessionData] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
const [manualSearch, setManualSearch] = useState('');
const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
const [loadingEnrolled, setLoadingEnrolled] = useState(false);

  const [totpToken, setTotpToken] = useState('');
  const [countdown, setCountdown] = useState(5);
  const [qrKey, setQrKey] = useState(0);
  const [qrFlash, setQrFlash] = useState(false);

  const qrIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const blocked =
        (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) ||
        (e.ctrlKey && (e.key === 'p' || e.key === 'P')) ||
        e.key === 'F12';
      const macBlocked =
        e.metaKey && e.shiftKey && (e.key === '4' || e.key === '5' || e.key === '6');

      if (blocked || macBlocked) {
        e.preventDefault();
        e.stopPropagation();
        toast.error('Screenshots are not allowed during live sessions.', { duration: 3000 });
        return false;
      }
    };

    const contextHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-qr-panel]')) {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener('keydown', handler, true);
    document.addEventListener('contextmenu', contextHandler, true);
    return () => {
      document.removeEventListener('keydown', handler, true);
      document.removeEventListener('contextmenu', contextHandler, true);
    };
  }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    setLoading(true);

    const unsubSession = onSnapshot(
      doc(db, collections.SESSIONS, sessionId),
      (snap) => {
        if (snap.exists()) setSessionData({ id: snap.id, ...snap.data() });
        setLoading(false);
      },
      (err) => {
        console.error('Session listener error:', err);
        setLoading(false);
      }
    );

    const unsubAtt = onSnapshot(
      collection(db, `${collections.SESSIONS}/${sessionId}/attendance`),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a: any, b: any) => (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0));
        setAttendance(list);
      },
      (err) => {
        console.error('Attendance listener error:', err);
      }
    );

    return () => { unsubSession(); unsubAtt(); };
  }, [sessionId]);

  const refreshQR = useCallback(() => {
    if (!sessionData?.totpSecret) return;
    const token = getCurrentTOTP(sessionData.totpSecret);
    const genTime = Date.now();
    setTotpToken(token);
    setQrKey((k) => k + 1);
    setCountdown(5);
    setQrFlash(true);
    setTimeout(() => setQrFlash(false), 300);

    console.log('[QR] Token refreshed', {
      generatedAt: new Date(genTime).toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      tokenPreview: token.substring(0, 2) + '****',
      period: '5s',
      sessionId,
    });
  }, [sessionData?.totpSecret, sessionId]);

  useEffect(() => {
    if (!sessionData?.totpSecret || sessionData?.status !== 'open') return;

    refreshQR();
    qrIntervalRef.current = setInterval(refreshQR, QR_DISPLAY_INTERVAL_MS);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 5 : c - 1));
    }, 1_000);

    return () => {
      if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [sessionData?.totpSecret, sessionData?.status, refreshQR]);

  const handleEndSession = async () => {
    if (!sessionId || ending) return;
    if (!confirm('End this session? Attendance data will be archived.')) return;
    setEnding(true);
    try {
      await closeSession(sessionId);
      await archiveSession(sessionId);
      navigate('/lecturer');
    } catch (err) {
      console.error(err);
      toast.error('Failed to end session.');
      setEnding(false);
    }
  };

  const [markingId, setMarkingId] = useState<string | null>(null);

  const handleMarkManual = async (studentId: string, studentName: string) => {
    if (!sessionId || !user) return;
    setMarkingId(studentId);
    try {
      await markManualAttendance(sessionId, studentId, studentName, user.uid);
      setManualSearch('');
      toast.success('Marked present.');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to mark attendance.');
    } finally {
      setMarkingId(null);
    }
  };

  const filteredEnrolled = enrolledStudents.filter((e: any) => {
    const sid = e.studentId || e.id;
    const name = (e.studentName || '').toLowerCase();
    return (
      !attendance.some((a: any) => (a.studentId || a.id) === sid) &&
      (name.includes(manualSearch.toLowerCase()) ||
        sid.toLowerCase().includes(manualSearch.toLowerCase()))
    );
  });

  const handleReopenSession = async () => {
    if (!sessionId) return;
    if (!confirm('Reopen this session to accept more check-ins?')) return;
    await updateDoc(doc(db, collections.SESSIONS, sessionId), { status: 'open' });
  };

  const handleExportCsv = () => {
    if (!sessionData) return;
    if (attendance.length === 0) {
      toast('No check-ins to export yet.', { icon: '📊' });
      return;
    }

    const rows: AttendanceCsvRow[] = attendance.map((a: any) => {
      const ts = formatTimestampExact(a.timestamp);
      return {
        studentId: a.studentId || '',
        studentName: a.studentName || '',
        studentEmail: a.studentEmail || '',
        regNumber: a.studentId || '',
        status: a.status || 'present',
        date: ts.date,
        timeIn: ts.time,
        courseCode: sessionData.courseCode || '',
        courseName: sessionData.courseName || '',
        room: sessionData.room || '',
        lecturerName: sessionData.lecturerName || '',
        topicOfDay: sessionData.topicOfDay || '',
        deviceFingerprint: a.deviceFingerprint || '',
      };
    });

    const csv = buildAttendanceCsv(rows);
    const safeCourse = (sessionData.courseCode || 'session').replace(/[^a-zA-Z0-9]/g, '_');
    downloadCsv(`attendance_${safeCourse}_${sessionData.date || 'export'}.csv`, csv);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--kabu-maroon)' }} />
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '32px', textAlign: 'center' }}>
        <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--danger)' }} />
        <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '22px', color: 'var(--text-primary)', marginBottom: '8px' }}>
          Session not found
        </h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
          This session may have ended or the link is invalid.
        </p>
        <button onClick={() => navigate('/lecturer')} className="btn-primary" style={{ padding: '10px 24px' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const qrData = `ksas://attend?sessionId=${sessionId}&token=${totpToken}`;
  const isOpen = sessionData.status === 'open';
  const totalEnrolled = sessionData.enrolledCount || 0;
  const totalPresent = attendance.length;
  const lateCount = attendance.filter((a: any) => a.status === 'late').length;
  const attendancePct = totalEnrolled > 0 ? Math.min(100, Math.round((totalPresent / totalEnrolled) * 100)) : 0;

  const countdownColor = countdown > 3 ? 'var(--success)' : countdown > 1 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div className="animate-page-in" style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 32px' }}>

      {/* Session header */}
      <div
        style={{
          padding: '20px',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '0.5px solid var(--bg-border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
          marginBottom: '24px',
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="flex h-3 w-3 relative"
                style={{ width: '10px', height: '10px', borderRadius: '9999px', background: isOpen ? 'var(--success)' : 'var(--text-tertiary)' }}
              >
                {isOpen && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--success)' }}></span>
                )}
              </span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: isOpen ? 'var(--success)' : 'var(--text-tertiary)' }}>
                {isOpen ? 'Session Live' : 'Session Closed'}
              </span>
              <span style={{ color: 'var(--text-tertiary)', margin: '0 6px' }}>·</span>
              {online ? (
                <span className="flex items-center gap-1" style={{ fontSize: '12px', color: 'var(--success)' }}>
                  <Wifi className="w-3 h-3" /> Connected
                </span>
              ) : (
                <span className="flex items-center gap-1" style={{ fontSize: '12px', color: 'var(--danger)' }}>
                  <WifiOff className="w-3 h-3" /> Offline
                </span>
              )}
            </div>
            <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '22px', color: 'var(--text-primary)' }}>
              {sessionData.courseName}
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {sessionData.courseCode} · Room {sessionData.room} · {sessionData.startTime}–{sessionData.endTime}
            </p>
            {sessionData.topicOfDay && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--kabu-maroon-tint)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 400, color: 'var(--kabu-maroon)', marginTop: '8px', maxWidth: '420px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <Bookmark className="w-4 h-4 shrink-0" style={{ color: 'var(--kabu-maroon)' }} />
                <span>{sessionData.topicOfDay.length > 60 ? sessionData.topicOfDay.slice(0, 60) + '…' : sessionData.topicOfDay}</span>
              </div>
            )}
            {(sessionData.requireGps || sessionData.requireIpRange || sessionData.allowedRadiusMeters) && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="badge badge-success" style={{ fontSize: '10px', padding: '2px 8px' }}>
                  <Smartphone className="w-3 h-3" /> Device Bound
                </span>
                <span className="badge badge-success" style={{ fontSize: '10px', padding: '2px 8px' }}>
                  <Shield className="w-3 h-3" /> Token Anti-Replay
                </span>
                {sessionData.requireGps && (
                  <span className="badge badge-info" style={{ fontSize: '10px', padding: '2px 8px' }}>
                    <MapPin className="w-3 h-3" /> GPS {sessionData.allowedRadiusMeters || 500}m
                  </span>
                )}
                {sessionData.requireIpRange && (
                  <span className="badge badge-info" style={{ fontSize: '10px', padding: '2px 8px' }}>
                    <Globe className="w-3 h-3" /> IP Range
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <button onClick={handleExportCsv} className="btn-ghost" style={{ fontSize: '13px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download className="w-4 h-4" /> Export CSV
            </button>
            {!isOpen && (
              <button onClick={handleReopenSession} className="btn-ghost" style={{ fontSize: '13px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RotateCcw className="w-4 h-4" /> Reopen
              </button>
            )}
            <button
              onClick={handleEndSession}
              disabled={!isOpen || ending}
              className="btn-danger"
              style={{ fontSize: '13px', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '6px', opacity: (!isOpen || ending) ? 0.5 : 1 }}
            >
              {ending && <Loader2 className="w-4 h-4 animate-spin" />}
              {ending ? 'Ending…' : 'End Session'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Left: Stats + attendance feed */}
        <div className="lg:col-span-7 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Present', value: totalPresent, bg: 'var(--success-bg)', color: 'var(--success)' },
              { label: 'Absent', value: Math.max(0, totalEnrolled - totalPresent), bg: 'var(--danger-bg)', color: 'var(--danger)' },
              { label: 'Late', value: lateCount, bg: 'var(--warning-bg)', color: 'var(--warning)' },
              { label: 'Enrolled', value: totalEnrolled, bg: 'var(--bg-elevated)', color: 'var(--text-primary)' },
            ].map((s) => (
              <div key={s.label} style={{ padding: '16px', background: s.bg, borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '4px' }}>{s.label}</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          <div style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--bg-border)' }}>
            <div className="flex justify-between" style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              <span>Check-in progress</span>
              <span>{totalPresent}/{totalEnrolled} ({attendancePct}%)</span>
            </div>
            <div style={{ width: '100%', background: 'var(--bg-elevated)', borderRadius: '9999px', height: '10px', overflow: 'hidden' }}>
              <div style={{ width: `${attendancePct}%`, height: '100%', background: attendancePct >= 75 ? 'var(--success)' : attendancePct >= 50 ? 'var(--warning)' : 'var(--danger)', borderRadius: '9999px', transition: 'width 700ms ease' }} />
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--bg-border)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: '0.5px solid var(--bg-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users className="w-4 h-4" /> Check-ins ({totalPresent})
              </h3>
              {isOpen && totalPresent === 0 && (
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock className="w-3.5 h-3.5" /> Waiting for students…
                </span>
              )}
            </div>

            <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
              {attendance.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  <AlertCircle className="w-8 h-8 mx-auto mb-2" style={{ opacity: 0.3 }} />
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px' }}>No check-ins yet.</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>Students scan the QR code to register.</p>
                </div>
              ) : (
                attendance.map((att: any) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between"
                    style={{ padding: '10px 20px', borderBottom: '0.5px solid var(--bg-border)', transition: 'background 150ms' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '9999px',
                          background: 'var(--kabu-maroon)',
                          color: 'var(--text-inverse)',
                          fontWeight: 700,
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {att.studentName?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{att.studentName}</p>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>{att.studentId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                      <span
                        className="badge"
                        style={{
                          background: att.status === 'late' ? 'var(--warning-bg)' : 'var(--success-bg)',
                          color: att.status === 'late' ? 'var(--warning)' : 'var(--success)',
                          border: `0.5px solid ${att.status === 'late' ? 'var(--warning)' : 'var(--success)'}`,
                          fontSize: '10px',
                          textTransform: 'capitalize',
                        }}
                      >
                        {att.status || 'present'}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        {att.timestamp?.toDate
                          ? att.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: QR code panel */}
        <div className="lg:col-span-5">
          <div
            data-qr-panel
            style={{
              background: 'var(--kabu-maroon)',
              borderRadius: 'var(--radius-xl)',
              padding: '24px',
              boxShadow: '0 0 24px rgba(139,21,56,0.2), 0 1px 3px rgba(0,0,0,0.3)',
              position: 'sticky',
              top: '80px',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            } as React.CSSProperties}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', color: 'var(--text-inverse)', fontWeight: 400 }}>Attendance QR</h3>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '2px' }}>Token refreshes every 5 seconds</p>
              </div>
              <div className="relative" style={{ width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg style={{ width: '56px', height: '56px', transform: 'rotate(-90deg)', position: 'absolute' }} viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
                  <circle
                    cx="28" cy="28" r="24"
                    fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="3"
                    strokeDasharray={`${2 * Math.PI * 24}`}
                    strokeDashoffset={`${2 * Math.PI * 24 * (1 - countdown / 5)}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1000ms linear' }}
                  />
                </svg>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: 'white', zIndex: 10, animation: countdown <= 1 ? 'pulse 1s infinite' : undefined }}>
                  {countdown}
                </span>
              </div>
            </div>

            <div
              style={{
                background: 'white',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                aspectRatio: '1',
                opacity: !isOpen ? 0.2 : qrFlash ? 0.6 : 1,
                transition: 'opacity 200ms',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {isOpen && totpToken && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 10 }}>
                  <div style={{ transform: 'rotate(-30deg)', fontSize: '11px', fontWeight: 700, color: 'rgba(123,26,43,0.08)', letterSpacing: '0.05em', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', userSelect: 'none' }}>
                    KSAS · {sessionData.courseCode} · {new Date().toLocaleDateString()} · SESSION
                  </div>
                </div>
              )}

              {totpToken && isOpen ? (
                <QRCodeSVG
                  key={qrKey}
                  value={qrData}
                  size={256}
                  style={{ width: '100%', height: '100%', userSelect: 'none' } as React.CSSProperties}
                  includeMargin={false}
                />
              ) : (
                <div className="flex flex-col items-center gap-3" style={{ color: 'var(--text-tertiary)' }}>
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px' }}>{isOpen ? 'Generating…' : 'Session closed'}</p>
                </div>
              )}
            </div>

            <div style={{ marginTop: '16px' }} className="space-y-2">
              <div className="flex items-center gap-2" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                <span>QR updates every 5s · Token changes each refresh</span>
              </div>
              <div className="flex items-center gap-2" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                <span>Students can scan within the validity window</span>
              </div>
            </div>

{!isOpen && (
              <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(231,76,60,0.2)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'white' }}>Session Ended</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '2px' }}>QR code is no longer active.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

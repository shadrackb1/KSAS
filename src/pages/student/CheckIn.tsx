import React, { useState, useEffect, useRef } from 'react';
import { QrCode, CheckCircle, Loader2, School, AlertCircle, MapPin, Wifi, Flame, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Scanner, isBarcodeDetectorSupported } from '@yudiel/react-qr-scanner';
import { useAuth } from '../../hooks/useAuth';
import { checkInStudent } from '../../lib/db';
import { CheckInSecurityContext, isDemoMode } from '../../lib/security';
import { db, doc, getDoc, getDocs, collection, where, query } from '../../lib/firebase';
import { collections } from '../../lib/db';
import { haptic, hapticSuccess } from '../../lib/haptics';
import { computeStreak } from '../../lib/gamification';
import {
  computeCheckinXpBreakdown,
  confettiCheckin,
  prefersReducedMotion,
  hapticPulse,
} from '../../lib/gamification-feedback';

function parseSessionTimeToDate(timeStr: string | null | undefined, dateBase: Date = new Date()): Date | null {
  if (!timeStr) return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const modifier = match[3]?.toUpperCase();
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  const d = new Date(dateBase);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export default function CheckIn() {
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(() => {
    try {
      return !isBarcodeDetectorSupported();
    } catch {
      return true;
    }
  });
  const [manualCode, setManualCode] = useState('');
  const [checkedInSession, setCheckedInSession] = useState<any>(null);
  const [securityWarnings, setSecurityWarnings] = useState<string[]>([]);
  const [celebration, setCelebration] = useState<{
    xpBreakdown: string;
    finalXp: number;
    streakCount: number;
    streakIncreased: boolean;
  } | null>(null);
  // Camera support check — BarcodeDetector WASM may not load in Firefox/older browsers
  const [cameraSupported] = useState(() => {
    try {
      return isBarcodeDetectorSupported();
    } catch {
      return false;
    }
  });

  // Scanner state: idle = showing tap overlay, scanning = camera active, paused = after scan
  const [scannerState, setScannerState] = useState<'idle' | 'scanning' | 'paused'>('idle');
  const [pendingSession, setPendingSession] = useState<any>(null);
  const [pendingToken, setPendingToken] = useState('');
  const [pendingSecurityContext, setPendingSecurityContext] = useState<CheckInSecurityContext | null>(null);

  const navigate = useNavigate();
  const { user } = useAuth();

  // Stable device fingerprint
  const deviceFingerprint = btoa(
    (navigator.userAgent + (window.screen?.width ?? 0) + (window.screen?.height ?? 0)).substring(0, 128)
  ).substring(0, 24);

  const getCoordinates = (): Promise<{ lat: number | null; lng: number | null }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lat: null, lng: null });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          resolve({ lat: null, lng: null });
        },
        { timeout: 5000, maximumAge: 60000 }
      );
    });
  };

  const getIpAddress = async (): Promise<string | undefined> => {
    try {
      const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      return data.ip;
    } catch {
      return undefined;
    }
  };

  const processQrData = async (qrData: string) => {
    setScannerState('paused');
    setLoading(true);
    setError(null);
    setSecurityWarnings([]);

    const scanTimestamp = Date.now();
    console.log('[CheckIn] QR scan initiated', {
      scanTime: new Date(scanTimestamp).toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      deviceFingerprint,
    });

    try {
      if (!qrData.startsWith('ksas://attend')) {
        throw new Error('Invalid QR code. Please scan the classroom QR code.');
      }

      const url = new URL(qrData);
      const sessionId = url.searchParams.get('sessionId');
      const token = url.searchParams.get('token');

      if (!sessionId || !token) throw new Error('QR code is missing session data.');

      if (!user) throw new Error('You must be logged in to check in.');

      // 1. Fetch Session
      const sessionRef = doc(db, collections.SESSIONS, sessionId);
      const sessionDoc = await getDoc(sessionRef);
      if (!sessionDoc.exists()) throw new Error('Session not found or has ended.');
      const sessionData = sessionDoc.data();

      const sessionStatus = sessionData.status;
      const sessionStartTime = sessionData.startTime;
      const sessionEndTime = sessionData.endTime;

      const now = new Date();
      const startDate = parseSessionTimeToDate(sessionStartTime);
      const endDate = parseSessionTimeToDate(sessionEndTime);

      console.log('[CheckIn] Session data fetched', {
        sessionId,
        status: sessionStatus,
        startTimeRaw: sessionStartTime,
        endTimeRaw: sessionEndTime,
        startDate: startDate?.toISOString() ?? null,
        endDate: endDate?.toISOString() ?? null,
        nowUTC: now.toISOString(),
        nowLocal: now.toString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        createdAt: sessionData.createdAt?.toDate?.()?.toISOString?.() ?? 'N/A',
      });

      // 2. Session time boundary validation (authoritative expiry check)
      if (!isDemoMode()) {
        if (startDate && now.getTime() < startDate.getTime()) {
          throw new Error('This session has not started yet. Please wait for the lecturer to begin.');
        }

        if (endDate && now.getTime() > endDate.getTime()) {
          throw new Error('QR code has expired. The session time has ended.');
        }

        if (sessionStatus !== 'open') throw new Error('This session is no longer accepting check-ins.');
      }

      // 3. Collect security context (GPS + IP in parallel)
      const [coordinates, ipAddress] = await Promise.all([getCoordinates(), getIpAddress()]);

      const securityContext: CheckInSecurityContext = {
        deviceFingerprint,
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        ipAddress,
      };

      // Validation passed — store pending session for confirmation
      setPendingSession({ ...sessionData, id: sessionId });
      setPendingToken(token);
      setPendingSecurityContext(securityContext);
    } catch (err: any) {
      setError(err.message || 'Check-in failed. Please try again.');
      haptic('error');
      // Return scanner to idle so user can retry
      setScannerState('idle');
    } finally {
      setLoading(false);
    }
  };

  const onScannerError = (err: any) => {
    console.error('[Scanner]', err);
    const message =
      err.kind === 'permission-denied'
        ? 'Camera permission denied. Allow camera access and tap the tile to retry.'
        : err.kind === 'in-use'
        ? 'Camera is in use by another app. Close other apps and try again.'
        : err.kind === 'insecure-context'
        ? 'Camera requires HTTPS or localhost. Use a secure connection.'
        : err.message?.includes('Barcode detection service unavailable') || err.message?.includes('detect')
        ? 'QR scanner is not supported on this device/browser. Use manual code entry below.'
        : `Camera error: ${err.message || 'unknown error'}`;
    setError(message);
    haptic('error');
    if (err.message?.includes('Barcode detection service unavailable') || !cameraSupported) {
      setManualMode(true);
    } else {
      setScannerState('idle');
    }
  };

  const confirmCheckIn = async () => {
    if (!pendingSession || !pendingToken || !user || !pendingSecurityContext) return;

    setLoading(true);
    setError(null);

    try {
      // Re-validate token in case it expired while user was on confirmation screen
      const now = new Date();
      const endDate = parseSessionTimeToDate(pendingSession.endTime);

      if (!isDemoMode() && endDate && now.getTime() > endDate.getTime()) {
        throw new Error('QR security token is no longer valid. Please scan again.');
      }

      if (!isDemoMode() && pendingSession.status !== 'open') {
        throw new Error('This session is no longer accepting check-ins. Please scan again.');
      }

      // Write attendance with security validation
      const result = await checkInStudent(pendingSession.id, user, pendingToken, deviceFingerprint, pendingSecurityContext);

      if (result?.warnings && result.warnings.length > 0) {
        setSecurityWarnings(result.warnings);
      }

      // Fetch attendance to compute streak for celebration
      let streakCount = 0;
      let prevStreak = 0;

      try {
        const sessionsSnap = await getDocs(collection(db, collections.SESSIONS));
        const attPromises = sessionsSnap.docs.map(async (sDoc) => {
          const attQ = query(collection(db, `${collections.SESSIONS}/${sDoc.id}/attendance`), where('studentId', '==', user.uid));
          const attSnap = await getDocs(attQ);
          return attSnap.docs.map((d) => ({ id: d.id, sessionId: sDoc.id, date: sDoc.data().date || '', ...d.data() }));
        });
        const attResults = await Promise.all(attPromises);
        const attList = attResults.flat();
        const streakData = computeStreak(attList);
        streakCount = streakData.current;
        prevStreak = streakCount > 1 ? streakCount - 1 : streakCount;
      } catch {
        // Streak computation failed — proceed without it
      }

      const streakIncreased = streakCount > prevStreak;
      const xpData = computeCheckinXpBreakdown(streakCount);

      setCheckedInSession(pendingSession);
      setCelebration({ xpBreakdown: xpData.bonusLabel, finalXp: xpData.finalXp, streakCount, streakIncreased });
      setPendingSession(null);
      setPendingToken('');
      setPendingSecurityContext(null);
      setScanned(true);

      // Celebration effects
      hapticSuccess();
      hapticPulse(50);
      confettiCheckin();

      setTimeout(() => {
        navigate('/student');
      }, 3500);
    } catch (err: any) {
      setError(err.message || 'Check-in failed. Please try again.');
      haptic('error');
      // Return to scanner so user can retry immediately
      setScannerState('idle');
    } finally {
      setLoading(false);
    }
  };

  const cancelPending = () => {
    setPendingSession(null);
    setPendingToken('');
    setPendingSecurityContext(null);
    setError(null);
    setScannerState('idle');
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processQrData(manualCode.trim());
  };

  return (
    <div className="flex-grow flex items-center justify-center p-md md:p-gutter max-w-7xl mx-auto w-full min-h-[80vh] animate-page-in">
      <div className="w-full max-w-[448px] bg-surface-container-lowest rounded-2xl shadow-lg border border-outline-variant/20 p-6 flex flex-col items-center relative overflow-hidden">

        <div className="text-center mb-6">
          <h2 className="font-headline-md text-primary mb-2">Attendance Check-In</h2>
          <p className="font-body-sm text-on-surface-variant">
            Scan the QR code displayed in your classroom to mark attendance.
          </p>
        </div>

        {user && (
          <div className="w-full bg-primary-container/20 rounded-xl px-4 py-3 mb-4 flex items-center gap-3 text-sm">
            <School className="w-4 h-4 text-primary shrink-0" />
            <span className="text-on-surface font-medium truncate">
              Checking in as <strong>{user.name}</strong> <span className="text-on-surface-variant font-mono text-xs">({user.uid})</span>
            </span>
          </div>
        )}

        {securityWarnings.length > 0 && (
          <div className="w-full bg-warning-bg rounded-xl px-4 py-3 mb-4 flex items-start gap-3 text-xs" style={{ color: 'var(--warning)', border: '1px solid rgba(184,134,11,0.3)' }}>
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              {securityWarnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="w-full bg-error-container text-on-error-container p-4 rounded-xl mb-4 text-sm font-medium text-center flex items-start justify-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="text-left">{error}</span>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-on-surface-variant text-sm">Verifying your attendance...</p>
            <div className="flex items-center gap-4 text-xs text-on-surface-variant/60">
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> GPS</span>
              <span className="flex items-center gap-1"><Wifi className="w-3 h-3" /> IP</span>
              <span className="flex items-center gap-1"><QrCode className="w-3 h-3" /> Token</span>
            </div>
          </div>
        )}

        {/* Confirmation Screen */}
        {!loading && pendingSession && !scanned && (
          <div className="w-full">
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--success-bg)', border: '1px solid var(--success)' }}>
                <QrCode className="w-7 h-7" style={{ color: 'var(--success)' }} />
              </div>
              <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '18px', color: 'var(--text-primary)' }}>Confirm Check-In</h3>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>Is this the right class?</p>
            </div>

            <div className="w-full rounded-xl p-5 mb-5" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
              <p style={{ fontFamily: 'var(--font-editorial)', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                {pendingSession.courseName}
              </p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                {pendingSession.courseCode}
              </p>
              <div className="space-y-2">
                {pendingSession.room && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)' }}>Room {pendingSession.room}</span>
                  </div>
                )}
                {pendingSession.lecturerName && (
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 shrink-0 flex items-center justify-center text-xs" style={{ color: 'var(--text-tertiary)' }}>@</span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)' }}>{pendingSession.lecturerName}</span>
                  </div>
                )}
                {pendingSession.startTime && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-secondary)' }}>{pendingSession.startTime} – {pendingSession.endTime || '?'}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 w-full">
              <button
                onClick={cancelPending}
                className="flex-1 py-3 rounded-xl font-bold transition-all hover:opacity-80 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--bg-border)', fontFamily: 'var(--font-body)', fontSize: '14px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmCheckIn}
                className="flex-1 py-3 rounded-xl font-bold transition-all hover:opacity-90 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
                style={{ background: 'var(--kabu-maroon)', color: '#fff', border: 'none', fontFamily: 'var(--font-body)', fontSize: '14px', cursor: 'pointer' }}
              >
                Confirm Check-In
              </button>
            </div>
          </div>
        )}

        {/* Scanner Section — only shown when camera is supported */}
        {!loading && !pendingSession && !manualMode && !scanned && (
          <div className="w-full mb-2">
            {cameraSupported ? (
              <div className="w-full aspect-square max-w-[280px] mx-auto rounded-2xl overflow-hidden relative border-2 border-outline-variant bg-black">
                <Scanner
                  onScan={(result) => {
                    if (!result?.[0]?.rawValue) return;
                    setScannerState('paused');
                    processQrData(result[0].rawValue);
                  }}
                  onError={onScannerError}
                  formats={['qr_code']}
                  paused={scannerState === 'idle'}
                  constraints={{
                    facingMode: 'environment',
                  }}
                  sound={false}
                  scanDelay={0}
                  allowMultiple={false}
                />
                {/* Tap-to-start overlay — only shown when scanner is paused (idle) */}
                {scannerState === 'idle' && (
                  <div
                    onClick={() => setScannerState('scanning')}
                    className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer"
                    style={{ background: 'rgba(0,0,0,0.45)' }}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <QrCode className="w-16 h-16 text-white" />
                      <span className="text-sm font-bold text-white">Tap to Start Camera</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full rounded-2xl p-6 text-center" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
                <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--warning)' }} />
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Camera QR scanner unavailable
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Your browser doesn't support QR scanning. Use manual entry instead.
                </p>
                <button
                  onClick={() => setManualMode(true)}
                  className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
                  style={{ background: 'var(--kabu-maroon)', color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  Enter Code Manually
                </button>
              </div>
            )}
            {!cameraSupported && (
              <button
                onClick={() => setManualMode(true)}
                className="font-label-md text-primary hover:text-primary/70 transition-colors mt-3"
              >
                Having trouble scanning? Enter code manually
              </button>
            )}
          </div>
        )}

        {/* Manual Code Entry */}
        {!loading && !pendingSession && manualMode && !scanned && (
          <form onSubmit={handleManualSubmit} className="w-full space-y-4 mb-6">
            <div>
              <label className="block text-sm font-bold text-on-surface mb-1">Paste the QR Link</label>
              <textarea
                required
                rows={4}
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="ksas://attend?sessionId=...&token=..."
                className="w-full bg-surface-container border border-outline-variant/50 rounded-xl py-3 px-4 focus:outline-none focus:border-primary transition-all text-on-surface text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setManualMode(false); setError(null); }}
                className="flex-1 py-3 font-bold text-on-surface-variant hover:bg-surface-variant/20 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-primary text-on-primary py-3 rounded-xl font-bold flex items-center justify-center hover:bg-primary/90 transition-all"
              >
                Submit
              </button>
            </div>
          </form>
        )}

        {/* Success overlay */}
        {scanned && celebration && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-50" style={{ background: 'var(--bg-base)', animation: 'fadeIn 300ms ease-out forwards' }}>
            <div className="relative mb-5">
              <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ background: 'var(--success-bg)', boxShadow: '0 0 40px rgba(34,197,94,0.3)', animation: 'badgePop 500ms cubic-bezier(0.16, 1, 0.3, 1)' }}>
                <CheckCircle className="w-14 h-14 text-success" />
              </div>
              {/* XP badge with floating animation */}
              <div
                className="absolute -top-2 -right-2 px-2 py-1 rounded-full text-xs font-bold"
                style={{
                  background: 'var(--gold-primary)',
                  color: '#fff',
                  fontFamily: 'var(--font-mono)',
                  animation: prefersReducedMotion() ? 'none' : 'xpBadgePop 2.2s ease-out forwards',
                  whiteSpace: 'nowrap',
                }}
              >
                {celebration.xpBreakdown}
              </div>
            </div>
            <h3 className="font-title-lg text-success mb-1">Attendance Confirmed</h3>
            {checkedInSession && (
              <p className="font-body-md text-on-surface font-bold mb-0.5">{checkedInSession.courseName}</p>
            )}
            {checkedInSession && (
              <p className="font-body-sm text-on-surface-variant mb-1">{checkedInSession.courseCode}</p>
            )}
            {/* Streak indicator */}
            {celebration.streakCount > 0 && (
              <div className="flex items-center gap-1.5 mt-3" style={{ animation: 'fadeIn 500ms ease-out 400ms both' }}>
                <Flame
                  className="w-5 h-5"
                  style={{
                    color: celebration.streakCount >= 7 ? '#EF4444' : 'var(--gold-primary)',
                    animation: prefersReducedMotion() || !celebration.streakIncreased
                      ? 'none'
                      : 'streakBounce 600ms cubic-bezier(0.34, 1.56, 0.64, 1) 500ms',
                  }}
                />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: celebration.streakCount >= 7 ? '#EF4444' : 'var(--gold-primary)' }}>
                  {celebration.streakCount} day streak{celebration.streakIncreased ? '!' : ''}
                </span>
              </div>
            )}
            <p className="font-body-sm text-on-surface-variant mt-3" style={{ fontSize: '12px', opacity: 0.7 }}>
              Redirecting to dashboard...
            </p>
            <style>{`
              @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
              @keyframes badgePop { 0% { transform: scale(0); } 50% { transform: scale(1.15); } 100% { transform: scale(1); } }
              @keyframes scaleIn { 0% { transform: scale(0); } 100% { transform: scale(1); } }
              @keyframes xpBadgePop { 0% { opacity: 0; transform: scale(0.5) translateY(0); } 15% { opacity: 1; transform: scale(1.1) translateY(-4px); } 30% { opacity: 1; transform: scale(1) translateY(-8px); } 70% { opacity: 1; transform: scale(1) translateY(-8px); } 100% { opacity: 0; transform: scale(0.9) translateY(-40px); } }
              @keyframes streakBounce { 0% { transform: scale(1); } 40% { transform: scale(1.3); } 100% { transform: scale(1); } }
  `}</style>
    </div>
  )}
</div>
</div>
  );
}

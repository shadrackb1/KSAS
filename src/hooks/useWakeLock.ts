import { useEffect, useRef, useState } from 'react';

export function useWakeLock(enabled: boolean) {
  const [isActive, setIsActive] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;

    let cancelled = false;

    const requestLock = async () => {
      try {
        const sentinel = await (navigator as any).wakeLock.request('screen');
        if (cancelled) { sentinel.release(); return; }
        wakeLockRef.current = sentinel;
        setIsActive(true);
        sentinel.addEventListener('release', () => setIsActive(false));
      } catch {
        setIsActive(false);
      }
    };

    requestLock();

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        requestLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      wakeLockRef.current?.release();
      wakeLockRef.current = null;
      setIsActive(false);
    };
  }, [enabled]);

  return { isActive };
}

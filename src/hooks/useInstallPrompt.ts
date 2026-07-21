import { useEffect, useState, useCallback, useRef } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const hasPromptedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);

      const hasDismissed = localStorage.getItem('ksas_install_dismissed') === '1';
      const hasAccepted  = localStorage.getItem('ksas_install_accepted') === '1';
      if (!hasDismissed && !hasAccepted && !hasPromptedRef.current) {
        setIsVisible(true);
        hasPromptedRef.current = true;
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone === true) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem('ksas_install_accepted', '1');
    }
    setIsVisible(false);
    setDeferredPrompt(null);
    return outcome === 'accepted';
  }, [deferredPrompt]);

  const dismissInstall = useCallback(() => {
    setIsVisible(false);
    localStorage.setItem('ksas_install_dismissed', '1');
  }, []);

  return { promptInstall, dismissInstall, isVisible, isInstalled, canInstall: !!deferredPrompt };
}

import React from 'react';
import { Download, X, Smartphone } from 'lucide-react';

interface InstallBannerProps {
  visible: boolean;
  canInstall: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}

export default function InstallBanner({ visible, canInstall, onInstall, onDismiss }: InstallBannerProps) {
  if (!visible || !canInstall) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: '420px',
        zIndex: 9999,
        background: 'linear-gradient(135deg, #8B1538 0%, #A8264F 100%)',
        borderRadius: '20px',
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        boxShadow: '0 12px 40px rgba(139,21,56,0.45)',
        animation: 'slideUp 400ms ease-out both',
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      <style>{`
        @keyframes pwaSlideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(24px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      <div
        style={{
          width: '44px',
          minWidth: '44px',
          height: '44px',
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Smartphone className="w-5 h-5" stroke="#fff" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontWeight: 700,
            fontSize: '14px',
            color: '#fff',
            lineHeight: 1.3,
          }}
        >
          Install KSAS
        </p>
        <p
          style={{
            margin: '3px 0 0',
            fontWeight: 400,
            fontSize: '12px',
            color: 'rgba(255,255,255,0.80)',
            lineHeight: 1.4,
          }}
        >
          Add to home screen for quick access to attendance &amp; check-in.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={onInstall}
          aria-label="Install KSAS"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '9px 14px',
            borderRadius: '10px',
            background: '#fff',
            color: '#8B1538',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '12px',
            fontFamily: "'Outfit', sans-serif",
            whiteSpace: 'nowrap',
          }}
        >
          <Download className="w-3.5 h-3.5" />
          Install
        </button>
        <button
          onClick={onDismiss}
          aria-label="Dismiss install banner"
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X className="w-3.5 h-3.5" stroke="rgba(255,255,255,0.9)" />
        </button>
      </div>
    </div>
  );
}

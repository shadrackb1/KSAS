import React, { useEffect, useState } from 'react';
import { XpFloatProps } from './types';
import { prefersReducedMotion, hapticPulse } from '../../lib/gamification-feedback';

export function XpFloat({ amount, multiplier, breakdown, delay = 300 }: XpFloatProps) {
  const [visible, setVisible] = useState(false);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(true);
      hapticPulse(40);
    }, delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (visible && !reduced) {
      const t = setTimeout(() => setVisible(false), 2200);
      return () => clearTimeout(t);
    }
  }, [visible, reduced]);

  if (!visible) return null;

  const text = breakdown || `+${amount} XP`;

  if (reduced) {
    return (
      <div
        style={{
          position: 'absolute',
          top: '-8px',
          right: '-8px',
          zIndex: 60,
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          fontWeight: 700,
          color: 'var(--gold-primary)',
          background: 'var(--gold-subtle)',
          padding: '2px 8px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--gold-muted)',
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '-8px',
        right: '-8px',
        zIndex: 60,
        fontFamily: 'var(--font-mono)',
        fontSize: '13px',
        fontWeight: 700,
        color: 'var(--gold-primary)',
        background: 'var(--gold-subtle)',
        padding: '2px 8px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--gold-muted)',
        whiteSpace: 'nowrap',
        animation: 'xpFloatUp 2s ease-out forwards',
        pointerEvents: 'none',
      }}
    >
      {text}
      <style>{`
        @keyframes xpFloatUp {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          30% { opacity: 1; transform: translateY(-16px) scale(1.08); }
          100% { opacity: 0; transform: translateY(-52px) scale(0.9); }
        }
      `}</style>
    </div>
  );
}

export function StreakBump({ streak }: { streak: number }) {
  const [bumping, setBumping] = useState(false);
  const prevRef = React.useRef(streak);

  useEffect(() => {
    if (streak > prevRef.current) {
      setBumping(true);
      hapticPulse(30);
      const t = setTimeout(() => setBumping(false), 600);
      prevRef.current = streak;
      return () => clearTimeout(t);
    }
    prevRef.current = streak;
  }, [streak]);

  return (
    <span
      style={{
        display: 'inline-flex',
        transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: bumping ? 'scale(1.25)' : 'scale(1)',
      }}
    >
      {streak}
    </span>
  );
}

interface BadgeUnlockToastProps {
  badgeName: string;
  badgeIcon: string;
  xpReward?: number;
  onDismiss: () => void;
}

export function BadgeUnlockToast({ badgeName, badgeIcon, xpReward, onDismiss }: BadgeUnlockToastProps) {
  const reduced = prefersReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 400);
    }, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        background: 'var(--bg-void)',
        border: '1px solid var(--gold-muted)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px 18px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        maxWidth: '320px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: reduced ? 'opacity 0.2s' : 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--gold-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          animation: reduced ? 'none' : 'badgePop 500ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <span style={{ fontSize: '20px' }}>🏆</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', fontWeight: 600, color: 'var(--gold-primary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '2px' }}>
          Badge Unlocked!
        </p>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          {badgeName}
        </p>
        {xpReward && xpReward > 0 && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--gold-primary)', marginTop: '2px' }}>
            +{xpReward} XP
          </p>
        )}
      </div>
      <button
        onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-tertiary)',
          padding: '4px',
          flexShrink: 0,
        }}
      >
        ✕
      </button>
      <style>{`
        @keyframes badgePop {
          0% { transform: scale(0) rotate(-20deg); }
          50% { transform: scale(1.15) rotate(5deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
      `}</style>
    </div>
  );
}

interface LevelUpModalProps {
  level: number;
  levelName: string;
  onDismiss: () => void;
}

export function LevelUpModal({ level, levelName, onDismiss }: LevelUpModalProps) {
  const reduced = prefersReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 400);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        backdropFilter: 'blur(4px)',
      }}
      onClick={handleDismiss}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-void)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--gold-muted)',
          padding: '40px',
          maxWidth: '380px',
          width: '90%',
          textAlign: 'center',
          boxShadow: '0 24px 64px rgba(0,0,0,0.2), 0 0 80px rgba(197,165,90,0.15)',
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.85) translateY(20px)',
          transition: reduced ? 'opacity 0.2s' : 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'var(--gold-subtle)',
            border: '2px solid var(--gold-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            animation: reduced ? 'none' : 'levelUpPulse 1.5s ease-in-out infinite',
          }}
        >
          <span style={{ fontSize: '36px' }}>⬆️</span>
        </div>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold-primary)', marginBottom: '8px' }}>
          Level Up!
        </p>
        <p style={{ fontFamily: 'var(--font-editorial, Gloock, serif)', fontSize: '28px', color: 'var(--text-primary)', margin: '0 0 8px' }}>
          {levelName}
        </p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 24px' }}>
          Level {level}
        </p>
        <button
          onClick={handleDismiss}
          style={{
            background: 'var(--gold-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: '10px 32px',
            fontFamily: 'Outfit, sans-serif',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'transform 0.15s',
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.96)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          Continue
        </button>
      </div>
      <style>{`
        @keyframes levelUpPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(197,165,90,0.4); }
          50% { box-shadow: 0 0 0 16px rgba(197,165,90,0); }
        }
      `}</style>
    </div>
  );
}

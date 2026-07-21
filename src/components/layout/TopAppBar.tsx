import React, { useState, useRef, useEffect } from 'react';
import { Bell, LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';
import { env } from '../../lib/env';

interface TopAppBarProps {
  role: 'student' | 'lecturer' | 'admin' | 'hod' | 'dean' | 'associate-dean';
  user: { name?: string };
}

function getInitials(name?: string) {
  if (!name) return 'U';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

export function TopAppBar({ role, user }: TopAppBarProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasNotifs, setHasNotifs] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  const profilePath = `/${role}/profile`;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const ROLE_LABELS = { student: 'Student', lecturer: 'Lecturer', admin: 'Administrator', hod: 'HOD', dean: 'Dean', 'associate-dean': 'Associate Dean' };

  const TIER_CONFIG: Record<string, { label: string; style: React.CSSProperties }> = {
    admin: {
      label: 'T1',
      style: {
        background: 'var(--kabu-maroon)',
        color: '#fff',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '9px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        padding: '1px 6px',
        borderRadius: '4px',
        lineHeight: '16px',
      },
    },
    dean: {
      label: 'T2',
      style: {
        background: 'transparent',
        color: 'var(--kabu-maroon)',
        border: '1px solid var(--kabu-maroon-subtle)',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '9px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        padding: '0px 5px',
        borderRadius: '4px',
        lineHeight: '16px',
      },
    },
    'associate-dean': {
      label: 'T3',
      style: {
        background: 'var(--kabu-maroon-tint)',
        color: 'var(--kabu-maroon)',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '9px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        padding: '1px 6px',
        borderRadius: '4px',
        lineHeight: '16px',
      },
    },
    hod: {
      label: 'T4',
      style: {
        background: 'var(--bg-elevated)',
        color: 'var(--text-secondary)',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '9px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        padding: '1px 6px',
        borderRadius: '4px',
        lineHeight: '16px',
      },
    },
    lecturer: {
      label: 'T5',
      style: {
        background: 'transparent',
        color: 'var(--text-tertiary)',
        border: '1px solid var(--bg-border)',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '9px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        padding: '0px 5px',
        borderRadius: '4px',
        lineHeight: '16px',
      },
    },
    student: {
      label: 'T6',
      style: {
        background: 'transparent',
        color: 'var(--text-tertiary)',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '9px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        padding: '1px 6px',
        borderRadius: '4px',
        lineHeight: '16px',
      },
    },
  };

  const tierConfig = TIER_CONFIG[role];

  return (
    <header className="top-bar px-4 md:px-6">
      {/* Mobile brand */}
      <div className="flex items-center gap-2 md:hidden">
        <img
          src={env.app.logoUrl}
          alt="Kabarak University"
          className="w-9 h-9"
          style={{ objectFit: 'contain', imageRendering: '-webkit-optimize-contrast' }}
          draggable={false}
        />
        <span className="text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>KSAS</span>
      </div>

      {/* Desktop: empty left (sidebar has branding) */}
      <div className="hidden md:block" />

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Notifications */}
        <button className="relative btn-icon" aria-label="Notifications" onClick={() => setHasNotifs(false)}>
          <Bell className="w-5 h-5" />
          {hasNotifs && (
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ background: 'var(--danger)', boxShadow: '0 0 0 2px var(--bg-void)' }} />
          )}
        </button>

        {/* Profile dropdown */}
        <div className="relative ml-1" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className={cn('flex items-center gap-2 rounded-full transition-all h-10 px-2')}
            style={{ background: menuOpen ? 'var(--bg-elevated)' : 'transparent' }}
            onMouseEnter={(e) => { if (!menuOpen) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
            onMouseLeave={(e) => { if (!menuOpen) e.currentTarget.style.background = 'transparent'; }}
            aria-expanded={menuOpen}
            aria-label="Account menu"
          >
            <img
              src={env.app.logoUrl}
              alt="Kabarak University"
              className="w-9 h-9"
              style={{ objectFit: 'contain', imageRendering: '-webkit-optimize-contrast' }}
              draggable={false}
            />
            {tierConfig && (
              <span style={tierConfig.style}>{tierConfig.label}</span>
            )}
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-12 w-56 overflow-hidden z-50 animate-scale-in"
              style={{
                background: 'var(--bg-void)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--bg-border)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              <div className="px-4 py-3.5" style={{ borderBottom: '1px solid var(--bg-border)', background: 'var(--bg-elevated)' }}>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>{user?.name || 'User'}</p>
                  {tierConfig && <span style={tierConfig.style}>{tierConfig.label}</span>}
                </div>
                <p className="text-xs capitalize mt-0.5" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>{ROLE_LABELS[role]}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => { navigate(profilePath); setMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                >
                  <User className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                  Profile & Settings
                </button>
                <div className="mx-3 my-1" style={{ height: '1px', background: 'var(--bg-border)' }} />
                <button
                  onClick={() => { logout(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors"
                  style={{ color: 'var(--danger)', fontFamily: 'var(--font-body)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--danger-bg)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

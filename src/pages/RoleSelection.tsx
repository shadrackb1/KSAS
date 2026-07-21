import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db, collection, query, where, getDocs } from '../lib/firebase';
import { hashPassword } from '../lib/auth';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import InstallBanner from '../components/PWAInstallBanner';
import {
  ArrowLeft,
  Lock,
  Mail,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Shield,
  Building2,
  Users,
  BookOpen,
  GraduationCap,
  Briefcase,
} from 'lucide-react';

const ROLES = [
  {
    id: 'admin' as const,
    title: 'Admin',
    desc: 'Full system control & university management',
    Icon: Shield,
  },
  {
    id: 'dean' as const,
    title: 'Dean',
    desc: 'University-wide oversight & institutional reports',
    Icon: Building2,
  },
  {
    id: 'associate-dean' as const,
    title: 'Associate Dean',
    desc: 'Faculty & School-wide monitoring',
    Icon: Users,
  },
  {
    id: 'hod' as const,
    title: 'HOD',
    desc: 'Departmental oversight & academic reports',
    Icon: Briefcase,
  },
  {
    id: 'lecturer' as const,
    title: 'Lecturer',
    desc: 'Manage courses & run live sessions',
    Icon: BookOpen,
  },
  {
    id: 'student' as const,
    title: 'Student',
    desc: 'Class check-in & personal attendance history',
    Icon: GraduationCap,
  },
] as const;

type RoleId = typeof ROLES[number]['id'];

function KabarakCrest() {
  return (
    <svg width="100" height="110" viewBox="0 0 100 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer shield shape */}
      <path d="M50 4L10 20V55C10 78 28 98 50 106C72 98 90 78 90 55V20L50 4Z"
            fill="#F9E8EA" stroke="#8B1538" strokeWidth="2.5" strokeLinejoin="round"/>
      {/* Inner shield */}
      <path d="M50 12L18 26V55C18 74 32 92 50 99C68 92 82 74 82 55V26L50 12Z"
            fill="white" stroke="#C9A84C" strokeWidth="1.2" strokeLinejoin="round"/>
      {/* Book / open pages */}
      <path d="M30 52V72C38 68 44 64 50 60C56 64 62 68 70 72V52L50 42L30 52Z"
            fill="#2D5A3D" stroke="#1A3D28" strokeWidth="0.8"/>
      {/* Torch / flame */}
      <rect x="47" y="30" width="6" height="18" rx="2" fill="#C9A84C"/>
      <path d="M50 22C50 22 44 30 44 34C44 38 47 40 50 40C53 40 56 38 56 34C56 30 50 22 50 22Z"
            fill="#8B1538"/>
      {/* Ribbon banner */}
      <path d="M25 82L50 76L75 82L72 90L50 86L28 90L25 82Z"
            fill="#8B1538" stroke="#6B1028" strokeWidth="0.5"/>
      {/* Banner text approximation */}
      <text x="50" y="86" textAnchor="middle" fill="white" fontSize="5" fontFamily="serif" fontWeight="600" letterSpacing="0.5">
        KABARAK UNIVERSITY
      </text>
    </svg>
  );
}

const ROUTE_MAP: Record<RoleId, string> = {
  admin: '/admin',
  dean: '/dean',
  'associate-dean': '/associate-dean',
  hod: '/hod',
  lecturer: '/lecturer',
  student: '/student',
};

const DB_ROLE_MAP: Record<RoleId, string> = {
  'admin': 'admin',
  'dean': 'admin',
  'associate-dean': 'admin',
  'hod': 'admin',
  'lecturer': 'lecturer',
  'student': 'student',
};

const SHOW_INSTALL_KEY = 'ksas_install_shown_v1';

export default function RoleSelection() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { promptInstall, dismissInstall, isVisible, canInstall } = useInstallPrompt();

  const [firstVisitPrompt, setFirstVisitPrompt] = useState(() => {
    return localStorage.getItem(SHOW_INSTALL_KEY) !== '1';
  });

  const [selectedRole, setSelectedRole] = useState<RoleId | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginAttempts, setLoginAttempts] = useState(0);

  useEffect(() => {
    try {
      const cached = localStorage.getItem('ksas_current_user');
      if (cached) {
        const u = JSON.parse(cached);
        if (u?.role) {
          navigate(ROUTE_MAP[u.role as RoleId] || '/', { replace: true });
          return;
        }
      }
    } catch {
      localStorage.removeItem('ksas_current_user');
    }

    if (firstVisitPrompt && isVisible) {
      const t = setTimeout(() => setFirstVisitPrompt(false), 600);
      return () => clearTimeout(t);
    }
  }, [navigate, firstVisitPrompt, isVisible]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    if (loginAttempts >= 5) {
      setError('Too many attempts. Please wait a moment before trying again.');
      setTimeout(() => setLoginAttempts(0), 30000);
      return;
    }
    setLoading(true);
    setError('');

    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('email', '==', email.toLowerCase().trim()),
        where('role', '==', DB_ROLE_MAP[selectedRole])
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setLoginAttempts((a) => a + 1);
        throw new Error('No account found with that email for this role.');
      }

      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();

      if (userData.password !== hashPassword(password)) {
        setLoginAttempts((a) => a + 1);
        throw new Error('Incorrect password. Please try again.');
      }

      if (userData.status === 'inactive') {
        throw new Error('This account has been deactivated. Contact your administrator.');
      }

      setLoginAttempts(0);
      login({ uid: userDoc.id, ...userData });
      localStorage.setItem(SHOW_INSTALL_KEY, '1');

      const isTVETorDev = typeof window !== 'undefined' &&
        window.matchMedia('(display-mode: standalone)').matches
        || (navigator as any).standalone === true;

      if (!isTVETorDev && canInstall && isVisible) {
        await promptInstall();
        localStorage.setItem('ksas_install_shown_v1', '1');
      }

      navigate(ROUTE_MAP[selectedRole], { replace: true });
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedRole(null);
    setError('');
    setEmail('');
    setPassword('');
    setShowPw(false);
    setLoginAttempts(0);
  };

  const isHighlighted = (id: RoleId) => selectedRole === id;

  return (
    <div className="ksas-root" style={{
      display: 'flex',
      minHeight: '100vh',
      animation: 'fadeUp 300ms ease-out',
      fontFamily: "'Outfit', sans-serif",
    }}>
      {/* ═══════════════ LEFT PANEL ═══════════════ */}
      <div className="ksas-left" style={{
        width: '40%',
        minWidth: '380px',
        background: '#F5E1E4',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 40px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle radial bloom */}
        <div style={{
          position: 'absolute',
          top: '-80px', left: '50%',
          transform: 'translateX(-50%)',
          width: '500px', height: '500px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Logo container */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          marginBottom: '24px',
        }}>
          <img
            src="/ksas-logo.png"
            alt="Kabarak University Crest"
            style={{ width: '140px', height: '140px', objectFit: 'contain', imageRendering: '-webkit-optimize-contrast' }}
            draggable={false}
          />
        </div>

        {/* Academic Portal heading */}
        <h1 style={{
          fontFamily: "'Gloock', serif",
          fontSize: '38px',
          fontWeight: 400,
          color: '#7B1A2B',
          letterSpacing: '-0.01em',
          lineHeight: 1.1,
          marginBottom: '16px',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
        }}>
          Academic Portal
        </h1>

        {/* Subtitle */}
        <p style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: '14px',
          fontWeight: 300,
          color: '#6B4A50',
          textAlign: 'center',
          lineHeight: 1.6,
          maxWidth: '320px',
          position: 'relative',
          zIndex: 1,
        }}>
          Secure access to university resources, academic management, and session attendance.
        </p>
      </div>

      {/* ═══════════════ RIGHT PANEL ═══════════════ */}
      <div className="ksas-right" style={{
        flex: 1,
        background: '#FDF8F8',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '64px 72px',
        animation: 'fadeUp 350ms 60ms ease-out both',
      }}>
        <div style={{ maxWidth: '520px', width: '100%' }}>
          {!selectedRole ? (
            /* ── Role Selection ────────────────────────────────── */
            <>
              <h1 style={{
                fontFamily: "'Big Shoulders Display', sans-serif",
                fontSize: '40px',
                fontWeight: 700,
                color: '#1A0508',
                letterSpacing: '-0.01em',
                marginBottom: '32px',
                lineHeight: 1.15,
              }}>
                Select Your Role
              </h1>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {ROLES.map((role) => {
                  const highlighted = isHighlighted(role.id);
                  const RoleIconComp = role.Icon;
                  return (
                    <div
                      key={role.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`Sign in as ${role.title}`}
                      onClick={() => setSelectedRole(role.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedRole(role.id); } }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '18px',
                        padding: '20px 22px',
                        border: `1px solid ${highlighted ? '#8B1538' : '#E8D8DA'}`,
                        borderRadius: '14px',
                        background: highlighted ? '#8B1538' : '#fff',
                        cursor: 'pointer',
                        transition: 'all 180ms ease',
                        textDecoration: 'none',
                        position: 'relative',
                        outline: 'none',
                        boxShadow: highlighted ? '0 0 0 3px rgba(139,21,56,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                      onMouseEnter={(e) => {
                        if (!highlighted) {
                          e.currentTarget.style.borderColor = '#C9A0A8';
                          e.currentTarget.style.background = '#FEF6F7';
                          e.currentTarget.style.boxShadow = '0 2px 12px rgba(139,21,56,0.08)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!highlighted) {
                          e.currentTarget.style.borderColor = '#E8D8DA';
                          e.currentTarget.style.background = '#fff';
                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                        }
                      }}
                      onFocus={(e) => {
                        if (!highlighted) {
                          e.currentTarget.style.borderColor = '#8B1538';
                          e.currentTarget.style.background = '#F9E8EA';
                          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139,21,56,0.12)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!highlighted) {
                          e.currentTarget.style.borderColor = '#E8D8DA';
                          e.currentTarget.style.background = '#fff';
                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                        }
                      }}
                    >
                      {/* Icon circle */}
                      <div style={{
                        width: '48px',
                        height: '48px',
                        minWidth: '48px',
                        borderRadius: '12px',
                        background: highlighted ? 'rgba(255,255,255,0.18)' : '#F9E8EA',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <RoleIconComp
                          size={22}
                          color={highlighted ? '#fff' : '#8B1538'}
                          strokeWidth={1.8}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{
                          fontSize: '16px',
                          fontWeight: 600,
                          color: highlighted ? '#fff' : '#1A0508',
                          display: 'block',
                          marginBottom: '2px',
                        }}>
                          {role.title}
                        </span>
                        <span style={{
                          fontSize: '13px',
                          fontWeight: 300,
                          color: highlighted ? 'rgba(255,255,255,0.7)' : '#6B4A50',
                          lineHeight: 1.4,
                          display: 'block',
                        }}>
                          {role.desc}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* ── Login Form ────────────────────────────────────── */
            <div className="animate-slide-up">
              <button
                onClick={handleBack}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: 400,
                  color: '#6B4A50',
                  fontFamily: "'Outfit', sans-serif",
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  marginBottom: '32px',
                  transition: 'color 160ms ease, transform 160ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#8B1538';
                  e.currentTarget.style.transform = 'translateX(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#6B4A50';
                  e.currentTarget.style.transform = 'translateX(0)';
                }}
              >
                <ArrowLeft className="w-4 h-4" />
                Change role
              </button>

              {/* Selected role indicator */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px 18px',
                background: '#F9E8EA',
                border: '1px solid #E8D8DA',
                borderRadius: '14px',
                marginBottom: '32px',
              }}>
                {(() => {
                  const roleData = ROLES.find(r => r.id === selectedRole);
                  const RoleIconComp = roleData?.Icon;
                  return (
                    <>
                      <div style={{
                        width: '40px', height: '40px', minWidth: '40px',
                        borderRadius: '10px',
                        background: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {RoleIconComp && <RoleIconComp size={20} color="#8B1538" strokeWidth={1.8} />}
                      </div>
                      <div>
                        <p style={{ fontSize: '15px', fontWeight: 600, color: '#1A0508', margin: 0 }}>
                          {roleData?.title}
                        </p>
                        <p style={{ fontSize: '12px', fontWeight: 300, color: '#6B4A50', margin: '4px 0 0' }}>
                          Sign in to your account
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div style={{ marginBottom: '32px' }}>
                <h2 style={{
                  fontFamily: "'Big Shoulders Display', sans-serif",
                  fontSize: '28px',
                  fontWeight: 700,
                  color: '#1A0508',
                  letterSpacing: '-0.01em',
                  margin: '0 0 4px',
                }}>
                  Welcome back
                </h2>
                <p style={{ fontSize: '13px', fontWeight: 300, color: '#6B4A50', margin: 0 }}>
                  Enter your credentials to continue.
                </p>
              </div>

              {error && (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px 16px',
                  background: '#FEF4F5',
                  border: '1px solid #E8A8B2',
                  borderRadius: '12px',
                  fontSize: '13px',
                  color: '#8B1538',
                  marginBottom: '24px',
                }}>
                  <AlertCircle className="w-4 h-4 shrink-0" style={{ marginTop: '1px' }} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="email" style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#6B4A50',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    fontFamily: "'Outfit', sans-serif",
                  }}>
                    Email
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail className="absolute" style={{ left: '14px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#9A7A82', pointerEvents: 'none' }} />
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@kabarak.ac.ke"
                      style={{
                        width: '100%',
                        padding: '12px 16px 12px 40px',
                        borderRadius: '12px',
                        border: '1px solid #EAD8DB',
                        background: '#fff',
                        color: '#1A0508',
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 150ms ease, box-shadow 150ms ease',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#8B1538'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139,21,56,0.1)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#EAD8DB'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="password" style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#6B4A50',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    fontFamily: "'Outfit', sans-serif",
                  }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock className="absolute" style={{ left: '14px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#9A7A82', pointerEvents: 'none' }} />
                    <input
                      id="password"
                      type={showPw ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      style={{
                        width: '100%',
                        padding: '12px 44px 12px 40px',
                        borderRadius: '12px',
                        border: '1px solid #EAD8DB',
                        background: '#fff',
                        color: '#1A0508',
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 150ms ease, box-shadow 150ms ease',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#8B1538'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139,21,56,0.1)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#EAD8DB'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#9A7A82',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        transition: 'color 150ms ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#1A0508'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#9A7A82'; }}
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    height: '48px',
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: 600,
                    fontSize: '14px',
                    letterSpacing: '0.03em',
                    background: loading ? '#A06070' : '#8B1538',
                    color: '#fff',
                    borderRadius: '12px',
                    border: 'none',
                    cursor: loading ? 'wait' : 'pointer',
                    boxShadow: '0 4px 16px rgba(139,21,56,0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginTop: '4px',
                    transition: 'box-shadow 200ms ease, transform 150ms ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.boxShadow = '0 6px 24px rgba(139,21,56,0.4)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(139,21,56,0.3)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Authenticating...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>

              <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid #EAD8DB' }}>
                <p style={{
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: 300,
                  color: '#9A7A82',
                  fontFamily: "'Outfit', sans-serif",
                }}>
                  Your account is created by your institution administrator.
                </p>
              </div>
            </div>
          )}
        </div>
  <InstallBanner
    visible={isVisible}
    canInstall={canInstall}
    onInstall={async () => {
      await promptInstall();
      localStorage.setItem('ksas_install_shown_v1', '1');
    }}
    onDismiss={() => {
      dismissInstall();
      localStorage.setItem('ksas_install_shown_v1', '1');
    }}
  />
</div>

<style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slideUp 0.25s ease-out forwards; }
        @media (max-width: 900px) {
          .ksas-root { flex-direction: column !important; }
          .ksas-left { width: 100% !important; min-width: unset !important; padding: 40px 24px 32px !important; }
          .ksas-right { padding: 40px 24px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  );
}

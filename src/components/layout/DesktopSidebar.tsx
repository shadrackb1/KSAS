import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard, School, BarChart, Calendar, Settings,
  BookOpen, Users, FileText, LogOut,
  QrCode, AlertTriangle, Archive, BarChart3, Home, Radio, Building,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { env } from '../../lib/env';

interface DesktopSidebarProps {
  role: 'student' | 'lecturer' | 'admin' | 'hod' | 'dean' | 'associate-dean';
  user: { name: string; id?: string; uid?: string; department?: string; role?: string; };
}

export function AvatarCircle({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : '?';
  const sizeClass = { lg: 'w-14 h-14 text-lg', md: 'w-11 h-11 text-sm', sm: 'w-8 h-8 text-xs' }[size];
  return (
    <div
      className={`${sizeClass} rounded-full font-bold flex items-center justify-center shrink-0`}
      style={{ background: 'var(--kabu-maroon)', color: 'var(--text-inverse)' }}
    >
      {initials}
    </div>
  );
}

export function DesktopSidebar({ role, user }: DesktopSidebarProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const profilePath = `/${role}/profile`;
  const displayId = user.uid || user.id || '';

  const ROLE_LABELS = {
    student: 'Student',
    lecturer: 'Lecturer',
    admin: 'Administrator',
    hod: 'HOD',
    dean: 'Dean',
    'associate-dean': 'Associate Dean',
  };

  const oversightNav = (r: string) => [
    { to: `/${r}`, icon: Home, label: 'Dashboard', end: true },
    { to: `/${r}/live`, icon: Radio, label: 'Live Monitor' },
    { to: `/${r}/lecturers`, icon: Users, label: 'Lecturers' },
    { to: `/${r}/analytics`, icon: BarChart3, label: 'Analytics' },
    { to: `/${r}/courses`, icon: BookOpen, label: 'Courses' },
    { to: `/${r}/reports`, icon: FileText, label: 'Reports' },
  ];

  const navLinks = {
    student: [
      { to: '/student', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/student/courses', icon: School, label: 'My Courses' },
      { to: '/student/checkin', icon: QrCode, label: 'Check-In' },
      { to: '/student/analytics', icon: BarChart, label: 'Attendance Reports' },
      { to: '/student/calendar', icon: Calendar, label: 'Academic Calendar' },
      { to: '/student/profile', icon: Settings, label: 'Settings & Profile' },
    ],
    lecturer: [
      { to: '/lecturer', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/lecturer/courses', icon: BookOpen, label: 'My Courses' },
      { to: '/lecturer/live', icon: QrCode, label: 'Live Session' },
      { to: '/lecturer/risk', icon: AlertTriangle, label: 'Risk Monitor' },
      { to: '/lecturer/reports', icon: BarChart, label: 'Reports' },
      { to: '/lecturer/profile', icon: Settings, label: 'Settings & Profile' },
    ],
    admin: [
      { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/admin/users', icon: Users, label: 'User Management' },
      { to: '/admin/academics', icon: School, label: 'Academics' },
      { to: '/admin/courses', icon: BookOpen, label: 'Courses' },
      { to: '/admin/archive', icon: Archive, label: 'Session Archive' },
      { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
      { to: '/admin/reports', icon: FileText, label: 'Reports' },
      { to: '/admin/school-codes', icon: Building, label: 'School Codes' },
      { to: '/admin/settings', icon: Settings, label: 'Settings & Profile' },
    ],
    hod: oversightNav('hod'),
    dean: oversightNav('dean'),
    'associate-dean': oversightNav('associate-dean'),
  };

  const links = navLinks[role];

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-5 py-5 shrink-0" style={{ borderBottom: '1px solid var(--bg-border)' }}>
        <img
          src={env.app.logoUrl}
          alt="Kabarak University"
          className="w-10 h-10"
          style={{ objectFit: 'contain', imageRendering: '-webkit-optimize-contrast' }}
          draggable={false}
        />
        <div>
          <span className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>KSAS</span>
          <p className="text-[9px] uppercase tracking-[0.14em] leading-none mt-0.5" style={{ fontFamily: 'var(--font-body)', color: 'var(--text-tertiary)' }}>
            Kabarak Smart Attendance
          </p>
        </div>
      </div>

      {/* User Profile Card */}
      <button
        onClick={() => navigate(profilePath)}
        className="flex items-center gap-3 p-4 mx-3 mt-3 transition-colors group text-left"
        style={{ borderRadius: 'var(--radius-lg)', border: '1px solid transparent' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-elevated)';
          e.currentTarget.style.borderColor = 'var(--bg-border)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderColor = 'transparent';
        }}
      >
        <AvatarCircle name={user.name} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm truncate leading-tight" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>{user.name}</p>
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>{displayId}</p>
          <span className="badge badge-primary mt-1">{ROLE_LABELS[role]}</span>
        </div>
      </button>

      <div className="mx-5 my-2" style={{ height: '1px', background: 'var(--bg-border)' }} />

      {/* Navigation */}
      <nav className="flex-1 px-1 py-1 space-y-0.5 overflow-y-auto custom-scrollbar">
        {links.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => cn('sidebar-item', isActive && 'active')}
          >
            <Icon style={{ width: 18, height: 18 }} className="shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-5 pt-2 shrink-0" style={{ borderTop: '1px solid var(--bg-border)' }}>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 transition-colors group"
          style={{
            color: 'var(--danger)',
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            fontWeight: 500,
            borderRadius: 'var(--radius-md)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--danger-bg)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        >
          <LogOut className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

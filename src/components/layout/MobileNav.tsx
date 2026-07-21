import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard, School, QrCode, BarChart, User,
  BookOpen, AlertTriangle, Users, Settings, Home, Radio, BarChart3, FileText,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface MobileNavProps {
  role: 'student' | 'lecturer' | 'admin' | 'hod' | 'dean' | 'associate-dean';
}

const oversightNav = (r: string) => [
  { to: `/${r}`, icon: Home, label: 'Home', end: true },
  { to: `/${r}/live`, icon: Radio, label: 'Live' },
  { to: `/${r}/lecturers`, icon: Users, label: 'Lecturers' },
  { to: `/${r}/analytics`, icon: BarChart3, label: 'Analytics' },
  { to: `/${r}/courses`, icon: BookOpen, label: 'Courses' },
  { to: `/${r}/reports`, icon: FileText, label: 'Reports' },
];

export function MobileNav({ role }: MobileNavProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navLinks = {
    student: [
      { to: '/student', icon: LayoutDashboard, label: 'Home', end: true },
      { to: '/student/courses', icon: School, label: 'Courses' },
      { to: '/student/checkin', icon: QrCode, label: 'Check-In', highlight: true },
      { to: '/student/analytics', icon: BarChart, label: 'Reports' },
      { to: '/student/profile', icon: User, label: 'Profile' },
    ],
    lecturer: [
      { to: '/lecturer', icon: LayoutDashboard, label: 'Home', end: true },
      { to: '/lecturer/courses', icon: BookOpen, label: 'Courses' },
      { to: '/lecturer/live', icon: QrCode, label: 'Live', highlight: true },
      { to: '/lecturer/risk', icon: AlertTriangle, label: 'Risk' },
      { to: '/lecturer/profile', icon: User, label: 'Profile' },
    ],
    admin: [
      { to: '/admin', icon: LayoutDashboard, label: 'Home', end: true },
      { to: '/admin/users', icon: Users, label: 'Users' },
      { to: '/admin/courses', icon: BookOpen, label: 'Courses' },
      { to: '/admin/settings', icon: Settings, label: 'Settings' },
    ],
    hod: oversightNav('hod'),
    dean: oversightNav('dean'),
    'associate-dean': oversightNav('associate-dean'),
  };

  const links = navLinks[role];

  return (
    <nav className="mobile-nav md:hidden">
      <div className="flex items-center justify-around px-2 pt-2 pb-1">
        {links.map(({ to, icon: Icon, label, end, highlight }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => cn(
              'mobile-nav-item',
              isActive ? 'active' : '',
              highlight && !location.pathname.includes(to) ? '' : ''
            )}
          >
            {({ isActive }) => (
              <>
                <div
                  className="relative flex items-center justify-center transition-all duration-200"
                  style={{
                    borderRadius: 'var(--radius-md)',
                    width: highlight ? '48px' : '32px',
                    height: '32px',
                    background: highlight
                      ? isActive
                        ? 'var(--kabu-maroon)'
                        : 'var(--kabu-maroon-tint)'
                      : isActive
                        ? 'var(--kabu-maroon-tint)'
                        : 'transparent',
                  }}
                >
                  <Icon
                    style={{ width: 20, height: 20, color: highlight ? (isActive ? 'var(--text-inverse)' : 'var(--kabu-maroon)') : (isActive ? 'var(--kabu-maroon)' : 'var(--text-tertiary)') }}
                  />
                </div>
                <span
                  className="text-[10px] mt-0.5 transition-colors"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    color: isActive ? 'var(--kabu-maroon)' : 'var(--text-tertiary)',
                  }}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

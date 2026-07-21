import React, { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileNav } from './MobileNav';
import { TopAppBar } from './TopAppBar';
import { useAuth } from '../../hooks/useAuth';
import { Toaster } from 'react-hot-toast';

interface AppLayoutProps {
  role: 'student' | 'lecturer' | 'admin' | 'hod' | 'dean' | 'associate-dean';
}

export function AppLayout({ role }: AppLayoutProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate('/', { replace: true });
    else if (!loading && user && user.role !== role && user.role !== 'admin') navigate('/', { replace: true });
  }, [user, loading, navigate, role]);

  if (loading || !user) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="flex flex-col items-center gap-4">
        <img
          src="/kabarak-logo.png"
          alt="Kabarak University"
          className="w-16 h-16 animate-pulse"
          style={{ objectFit: 'contain', imageRendering: '-webkit-optimize-contrast' }}
          draggable={false}
        />
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Loading KSAS…</p>
      </div>
    </div>
  );
}

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'toast-custom',
          duration: 3500,
        }}
      />

      {/* Desktop Sidebar */}
      <DesktopSidebar role={role} user={user} />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 with-sidebar">
        <TopAppBar role={role} user={user} />

        <div className="flex-1 overflow-y-auto custom-scrollbar pb-20 md:pb-0">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <MobileNav role={role} />
    </div>
  );
}

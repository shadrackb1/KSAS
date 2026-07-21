import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';

import { useAuth } from './hooks/useAuth';

import { AppLayout } from './components/layout/AppLayout';
import { OversightAppLayout } from './components/layout/OversightAppLayout';

import NotFound from './pages/NotFound';
import ServerError from './pages/ServerError';

// Lazy load all page components for code splitting
const RoleSelection = lazy(() => import('./pages/RoleSelection'));

const StudentDashboard = lazy(() => import('./pages/student/Dashboard'));
const StudentCourses = lazy(() => import('./pages/student/Courses'));
const StudentCourseDetails = lazy(() => import('./pages/student/CourseDetails'));
const StudentAnalytics = lazy(() => import('./pages/student/Analytics'));
const StudentProfile = lazy(() => import('./pages/student/Profile'));
const StudentCheckIn = lazy(() => import('./pages/student/CheckIn'));

const LecturerDashboard = lazy(() => import('./pages/lecturer/Dashboard'));
const LecturerCourseManagement = lazy(() => import('./pages/lecturer/CourseManagement'));
const LecturerLiveSession = lazy(() => import('./pages/lecturer/LiveSession'));
const LecturerRiskMonitor = lazy(() => import('./pages/lecturer/RiskMonitor'));
const LecturerReports = lazy(() => import('./pages/lecturer/Reports'));

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminUserManagement = lazy(() => import('./pages/admin/UserManagement'));
const AdminCreateUser = lazy(() => import('./pages/admin/CreateUser'));
const AdminCourseManagement = lazy(() => import('./pages/admin/CourseManagement'));
const AdminSessionArchive = lazy(() => import('./pages/admin/SessionArchive'));
const AdminAnalytics = lazy(() => import('./pages/admin/Analytics'));
const AdminReports = lazy(() => import('./pages/admin/reports'));
const AdminSchoolCodes = lazy(() => import('./pages/admin/SchoolCodes'));

const OversightDashboard = lazy(() => import('./pages/oversight/Dashboard'));
const DeanDashboard = lazy(() => import('./pages/oversight/DeanDashboard'));
const AssociateDeanDashboard = lazy(() => import('./pages/oversight/AssociateDeanDashboard'));
const HodDashboard = lazy(() => import('./pages/oversight/HodDashboard'));
const OversightLiveTeachingMonitor = lazy(() => import('./pages/oversight/LiveTeachingMonitor'));
const OversightLecturerOversight = lazy(() => import('./pages/oversight/LecturerOversight'));
const OversightDepartmentAnalytics = lazy(() => import('./pages/oversight/DepartmentAnalytics'));
const OversightCourseOverview = lazy(() => import('./pages/oversight/CourseCurriculumOverview'));
const OversightReports = lazy(() => import('./pages/oversight/Reports'));

const ROLE_ROUTES = { student: '/student', lecturer: '/lecturer', admin: '/admin', hod: '/hod', dean: '/dean', 'associate-dean': '/associate-dean' };

// Loading fallback component
function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          border: '3px solid var(--bg-border, #EAD8DB)',
          borderTopColor: 'var(--kabu-maroon, #7B1A2B)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px'
        }} />
        <p style={{ color: 'var(--text-secondary, #6B4A50)', fontSize: '14px' }}>Loading…</p>
      </div>
    </div>
  );
}

// Wrap role-specific outlets with Suspense
function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

function RoleGuard({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { user } = useAuth();
  if (!user?.role) return <Navigate to="/" replace />;
  if (!allowedRoles.includes(user.role as string)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Error fallback for lazy components
function LazyErrorFallback({ componentName, retry }: { componentName: string; retry: () => void }) {
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>Failed to load {componentName}</p>
      <button 
        onClick={retry}
        style={{
          padding: '8px 16px',
          borderRadius: '8px',
          border: '1px solid var(--bg-border)',
          background: 'var(--bg-surface)',
          cursor: 'pointer'
        }}
      >
        Retry
      </button>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SuspenseWrapper><RoleSelection /></SuspenseWrapper>} />

          {/* Student Routes */}
          <Route path="/student" element={<AppLayout role="student" />}>
            <Route index element={<SuspenseWrapper><StudentDashboard /></SuspenseWrapper>} />
            <Route path="courses" element={<SuspenseWrapper><StudentCourses /></SuspenseWrapper>} />
            <Route path="course-details" element={<SuspenseWrapper><StudentCourseDetails /></SuspenseWrapper>} />
            <Route path="analytics" element={<SuspenseWrapper><StudentAnalytics /></SuspenseWrapper>} />
            <Route path="profile" element={<SuspenseWrapper><StudentProfile /></SuspenseWrapper>} />
            <Route path="checkin" element={<SuspenseWrapper><StudentCheckIn /></SuspenseWrapper>} />
            <Route path="calendar" element={<SuspenseWrapper><StudentDashboard /></SuspenseWrapper>} />
          </Route>

          {/* Lecturer Routes */}
          <Route path="/lecturer" element={<AppLayout role="lecturer" />}>
            <Route index element={<SuspenseWrapper><LecturerDashboard /></SuspenseWrapper>} />
            <Route path="courses" element={<SuspenseWrapper><LecturerCourseManagement /></SuspenseWrapper>} />
            <Route path="live" element={<SuspenseWrapper><LecturerLiveSession /></SuspenseWrapper>} />
            <Route path="risk" element={<SuspenseWrapper><LecturerRiskMonitor /></SuspenseWrapper>} />
            <Route path="profile" element={<SuspenseWrapper><StudentProfile /></SuspenseWrapper>} />
            <Route path="reports" element={<SuspenseWrapper><LecturerReports /></SuspenseWrapper>} />
            <Route path="calendar" element={<SuspenseWrapper><LecturerDashboard /></SuspenseWrapper>} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin" element={
            <RoleGuard allowedRoles={['admin']}>
              <AppLayout role="admin" />
            </RoleGuard>
          }>
            <Route index element={<SuspenseWrapper><AdminDashboard /></SuspenseWrapper>} />
            <Route path="users/create" element={<SuspenseWrapper><AdminCreateUser /></SuspenseWrapper>} />
            <Route path="users" element={<SuspenseWrapper><AdminUserManagement /></SuspenseWrapper>} />
            <Route path="courses" element={<SuspenseWrapper><AdminCourseManagement /></SuspenseWrapper>} />
            <Route path="archive" element={<SuspenseWrapper><AdminSessionArchive /></SuspenseWrapper>} />
            <Route path="analytics" element={<SuspenseWrapper><AdminAnalytics /></SuspenseWrapper>} />
            <Route path="reports" element={<SuspenseWrapper><AdminReports /></SuspenseWrapper>} />
            <Route path="academics" element={<SuspenseWrapper><AdminDashboard /></SuspenseWrapper>} />
            <Route path="school-codes" element={<SuspenseWrapper><AdminSchoolCodes /></SuspenseWrapper>} />
            <Route path="settings" element={<SuspenseWrapper><AdminSchoolCodes /></SuspenseWrapper>} />
          </Route>

          {/* HOD Routes */}
          <Route path="/hod" element={
            <RoleGuard allowedRoles={['hod']}>
              <OversightAppLayout role="hod" />
            </RoleGuard>
          }>
            <Route index element={<SuspenseWrapper><HodDashboard /></SuspenseWrapper>} />
            <Route path="live" element={<SuspenseWrapper><OversightLiveTeachingMonitor /></SuspenseWrapper>} />
            <Route path="lecturers" element={<SuspenseWrapper><OversightLecturerOversight /></SuspenseWrapper>} />
            <Route path="analytics" element={<SuspenseWrapper><OversightDepartmentAnalytics /></SuspenseWrapper>} />
            <Route path="courses" element={<SuspenseWrapper><OversightCourseOverview /></SuspenseWrapper>} />
            <Route path="reports" element={<SuspenseWrapper><OversightReports /></SuspenseWrapper>} />
            <Route path="profile" element={<SuspenseWrapper><StudentProfile /></SuspenseWrapper>} />
          </Route>

          {/* Dean Routes */}
          <Route path="/dean" element={
            <RoleGuard allowedRoles={['dean']}>
              <OversightAppLayout role="dean" />
            </RoleGuard>
          }>
            <Route index element={<SuspenseWrapper><DeanDashboard /></SuspenseWrapper>} />
            <Route path="live" element={<SuspenseWrapper><OversightLiveTeachingMonitor /></SuspenseWrapper>} />
            <Route path="lecturers" element={<SuspenseWrapper><OversightLecturerOversight /></SuspenseWrapper>} />
            <Route path="analytics" element={<SuspenseWrapper><OversightDepartmentAnalytics /></SuspenseWrapper>} />
            <Route path="courses" element={<SuspenseWrapper><OversightCourseOverview /></SuspenseWrapper>} />
            <Route path="reports" element={<SuspenseWrapper><OversightReports /></SuspenseWrapper>} />
            <Route path="profile" element={<SuspenseWrapper><StudentProfile /></SuspenseWrapper>} />
          </Route>

          {/* Associate Dean Routes */}
          <Route path="/associate-dean" element={
            <RoleGuard allowedRoles={['associate-dean']}>
              <OversightAppLayout role="associate-dean" />
            </RoleGuard>
          }>
            <Route index element={<SuspenseWrapper><AssociateDeanDashboard /></SuspenseWrapper>} />
            <Route path="live" element={<SuspenseWrapper><OversightLiveTeachingMonitor /></SuspenseWrapper>} />
            <Route path="lecturers" element={<SuspenseWrapper><OversightLecturerOversight /></SuspenseWrapper>} />
            <Route path="analytics" element={<SuspenseWrapper><OversightDepartmentAnalytics /></SuspenseWrapper>} />
            <Route path="courses" element={<SuspenseWrapper><OversightCourseOverview /></SuspenseWrapper>} />
            <Route path="reports" element={<SuspenseWrapper><OversightReports /></SuspenseWrapper>} />
            <Route path="profile" element={<SuspenseWrapper><StudentProfile /></SuspenseWrapper>} />
          </Route>

          <Route path="/500" element={<ServerError />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
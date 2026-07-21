import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, useEffect } from 'react';
import { env, logger } from './env';

const STALE_TIME = 5 * 60 * 1000; // 5 minutes
const GC_TIME = 10 * 60 * 1000; // 10 minutes (formerly cacheTime)

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME,
        gcTime: GC_TIME,
        retry: (failureCount, error: any) => {
          // Don't retry on 4xx errors (except 429)
          if (error?.response?.status >= 400 && error?.response?.status < 500) {
            return error?.response?.status === 429;
          }
          // Retry up to 3 times for network/5xx errors
          return failureCount < 3;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchOnMount: 'always',
      },
      mutations: {
        retry: (failureCount, error: any) => {
          if (error?.response?.status >= 400 && error?.response?.status < 500) {
            return error?.response?.status === 429;
          }
          return failureCount < 2;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient();
  }
  // Browser: make a new query client if we don't already have one
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(getQueryClient);
  const [isDevToolsReady, setIsDevToolsReady] = useState(false);

  useEffect(() => {
    // Only load devtools in development
    if (import.meta.env.DEV) {
      import('@tanstack/react-query-devtools').then(() => {
        setIsDevToolsReady(true);
      }).catch(() => {});
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {isDevToolsReady && import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

// Query keys factory for consistent key management
export const queryKeys = {
  // User queries
  user: {
    current: () => ['user', 'current'] as const,
    profile: (userId: string) => ['user', 'profile', userId] as const,
  },
  
  // Course queries
  courses: {
    all: () => ['courses'] as const,
    list: (filters?: Record<string, any>) => ['courses', 'list', filters] as const,
    detail: (courseId: string) => ['courses', 'detail', courseId] as const,
    byLecturer: (lecturerId: string) => ['courses', 'lecturer', lecturerId] as const,
  },
  
  // Session queries
  sessions: {
    all: () => ['sessions'] as const,
    list: (filters?: Record<string, any>) => ['sessions', 'list', filters] as const,
    detail: (sessionId: string) => ['sessions', 'detail', sessionId] as const,
    byLecturer: (lecturerId: string) => ['sessions', 'lecturer', lecturerId] as const,
    byCourse: (courseCode: string) => ['sessions', 'course', courseCode] as const,
    live: (sessionId: string) => ['sessions', 'live', sessionId] as const,
  },
  
  // Attendance queries
  attendance: {
    bySession: (sessionId: string) => ['attendance', 'session', sessionId] as const,
    byStudent: (studentId: string) => ['attendance', 'student', studentId] as const,
    stats: (sessionId: string) => ['attendance', 'stats', sessionId] as const,
  },
  
  // Enrollment queries
  enrollments: {
    byStudent: (studentId: string) => ['enrollments', 'student', studentId] as const,
    byCourse: (courseCode: string) => ['enrollments', 'course', courseCode] as const,
  },
  
  // Analytics queries
  analytics: {
    dashboard: (role: string, userId: string) => ['analytics', 'dashboard', role, userId] as const,
    department: (department: string) => ['analytics', 'department', department] as const,
    faculty: (faculty: string) => ['analytics', 'faculty', faculty] as const,
    course: (courseCode: string) => ['analytics', 'course', courseCode] as const,
  },
  
  // User management
  users: {
    list: (filters?: Record<string, any>) => ['users', 'list', filters] as const,
    detail: (userId: string) => ['users', 'detail', userId] as const,
    byRole: (role: string) => ['users', 'role', role] as const,
  },
  
  // Feedback
  feedback: {
    byCourse: (courseCode: string) => ['feedback', 'course', courseCode] as const,
    bySession: (sessionId: string) => ['feedback', 'session', sessionId] as const,
  },
  
  // School codes
  schoolCodes: {
    all: () => ['schoolCodes'] as const,
  },
  
  // Audit logs
  auditLogs: {
    list: (filters?: Record<string, any>) => ['auditLogs', 'list', filters] as const,
  },
} as const;

// Mutation keys factory
export const mutationKeys = {
  auth: {
    login: () => ['auth', 'login'] as const,
    logout: () => ['auth', 'logout'] as const,
    updateProfile: () => ['auth', 'updateProfile'] as const,
    changePassword: () => ['auth', 'changePassword'] as const,
  },
  sessions: {
    create: () => ['sessions', 'create'] as const,
    update: (sessionId: string) => ['sessions', 'update', sessionId] as const,
    close: (sessionId: string) => ['sessions', 'close', sessionId] as const,
    archive: (sessionId: string) => ['sessions', 'archive', sessionId] as const,
  },
  attendance: {
    checkIn: (sessionId: string) => ['attendance', 'checkIn', sessionId] as const,
    manual: (sessionId: string) => ['attendance', 'manual', sessionId] as const,
  },
  courses: {
    create: () => ['courses', 'create'] as const,
    update: (courseId: string) => ['courses', 'update', courseId] as const,
  },
  users: {
    create: () => ['users', 'create'] as const,
    update: (userId: string) => ['users', 'update', userId] as const,
    delete: (userId: string) => ['users', 'delete', userId] as const,
    resetDevice: (userId: string) => ['users', 'resetDevice', userId] as const,
  },
  enrollments: {
    create: () => ['enrollments', 'create'] as const,
    update: (enrollmentId: string) => ['enrollments', 'update', enrollmentId] as const,
  },
  feedback: {
    create: () => ['feedback', 'create'] as const,
  },
  schoolCodes: {
    create: () => ['schoolCodes', 'create'] as const,
    update: (codeId: string) => ['schoolCodes', 'update', codeId] as const,
    delete: (codeId: string) => ['schoolCodes', 'delete', codeId] as const,
  },
} as const;
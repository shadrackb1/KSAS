// src/lib/collections.ts
// Firestore collection names — extracted to break circular dependency between db.ts and security.ts

export const collections = {
  USERS: 'users',
  SESSIONS: 'sessions',
  COURSES: 'courses',
  ENROLLMENTS: 'enrollments',
  AUDIT_LOGS: 'audit_logs',
  FEEDBACK: 'feedback',
  SCHOOL_CODES: 'school_codes',
  RATE_LIMITS: 'rate_limits',
};

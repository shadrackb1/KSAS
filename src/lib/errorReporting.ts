import { logger } from './env';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ErrorReport {
  id: string;
  timestamp: number;
  type: ErrorType;
  message: string;
  stack?: string;
  componentStack?: string;
  context: ErrorContext;
  userAgent: string;
  url: string;
  tags: Record<string, string>;
}

type ErrorType = 'react' | 'firestore' | 'network' | 'unhandled' | 'resource';

interface ErrorContext {
  userId?: string;
  role?: string;
  sessionId?: string;
  route?: string;
  firestorePath?: string;
  httpStatus?: number;
  networkType?: string;
  retryCount?: number;
}

interface RateLimitBucket {
  count: number;
  windowStart: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_REPORTS_PER_MINUTE = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const LOCAL_STORAGE_KEY = 'ksas_error_queue';
const MAX_QUEUED_REPORTS = 50;

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

let rateLimitBucket: RateLimitBucket = { count: 0, windowStart: Date.now() };

// ─────────────────────────────────────────────────────────────────────────────
// Sentry placeholder — replace with `@sentry/react` and `Sentry.init(...)`
// when DSN is configured.  All report methods are no-ops until captureFn is
// set by bootstrapErrorReporting().
// ─────────────────────────────────────────────────────────────────────────────

let captureFn: ((report: ErrorReport) => void) | null = null;

export function setCaptureHandler(fn: (report: ErrorReport) => void): void {
  captureFn = fn;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiter
// ─────────────────────────────────────────────────────────────────────────────

function checkRateLimit(): boolean {
  const now = Date.now();

  if (now - rateLimitBucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitBucket = { count: 0, windowStart: now };
  }

  if (rateLimitBucket.count >= MAX_REPORTS_PER_MINUTE) {
    logger.warn('[errorReporting] Rate limit hit — dropping report');
    return false;
  }

  rateLimitBucket.count++;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// User context helpers
// ─────────────────────────────────────────────────────────────────────────────

export interface UserErrorContext {
  userId?: string;
  role?: string;
  sessionId?: string;
}

let currentUserContext: UserErrorContext = {};

export function setUserContext(ctx: UserErrorContext): void {
  currentUserContext = { ...ctx };
}

export function clearUserContext(): void {
  currentUserContext = {};
}

// ─────────────────────────────────────────────────────────────────────────────
// Report builders
// ─────────────────────────────────────────────────────────────────────────────

function buildReport(
  type: ErrorType,
  error: Error,
  extraContext: Partial<ErrorContext> = {},
): ErrorReport {
  return {
    id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now(),
    type,
    message: error.message || String(error),
    stack: error.stack,
    context: {
      ...currentUserContext,
      ...extraContext,
    },
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    tags: {
      app: 'KSAS',
      version: import.meta.env.VITE_APP_VERSION || '1.2.0',
      mode: typeof import.meta !== 'undefined' && import.meta.env?.MODE
        ? import.meta.env.MODE
        : 'unknown',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Capture a Firestore write / read error.
 */
export function captureFirestoreError(
  error: Error,
  firestorePath: string,
  extra: Partial<ErrorContext> = {},
): void {
  const report = buildReport('firestore', error, {
    ...extra,
    firestorePath,
    httpStatus: (error as any).code ? undefined : 500,
  });

  dispatchReport(report);
}

/**
 * Capture a network / HTTP error.
 */
export function captureNetworkError(
  error: Error,
  url: string,
  httpStatus?: number,
  extra: Partial<ErrorContext> = {},
): void {
  const report = buildReport('network', error, {
    ...extra,
    httpStatus,
    networkType: typeof navigator !== 'undefined'
      ? ((navigator as any).connection?.effectiveType || 'unknown')
      : 'unknown',
  });

  dispatchReport(report);
}

/**
 * Capture a React component error (called from ErrorBoundary).
 */
export function captureReactError(
  error: Error,
  componentStack?: string,
  extra: Partial<ErrorContext> = {},
): void {
  const report = buildReport('react', error, {
    ...extra,
    route: typeof window !== 'undefined' ? window.location.pathname : undefined,
  });

  report.componentStack = componentStack;
  dispatchReport(report);
}

/**
 * Capture any unhandled error.
 */
export function captureUnhandledError(error: Error, extra: Partial<ErrorContext> = {}): void {
  const report = buildReport('unhandled', error, extra);
  dispatchReport(report);
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatch
// ─────────────────────────────────────────────────────────────────────────────

function dispatchReport(report: ErrorReport): void {
  if (!checkRateLimit()) return;

  // Persist to localStorage for offline debugging
  persistToLocalStorage(report);

  // Forward to active handler (Sentry when bootstrapped)
  if (captureFn) {
    try {
      captureFn(report);
    } catch (err) {
      logger.error('[errorReporting] Capture handler threw:', err);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LocalStorage queue — survives page reloads for offline review
// ─────────────────────────────────────────────────────────────────────────────

function persistToLocalStorage(report: ErrorReport): void {
  try {
    if (typeof localStorage === 'undefined') return;

    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const queue: ErrorReport[] = raw ? JSON.parse(raw) : [];

    queue.push(report);

    while (queue.length > MAX_QUEUED_REPORTS) {
      queue.shift();
    }

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    logger.debug('[errorReporting] localStorage write failed (private mode or quota exceeded)');
  }
}

/**
 * Flush the offline error queue — call on app init or network recovery.
 * Optionally pass a fn to forward each report to Sentry.
 */
export function flushErrorQueue(forwardFn?: (report: ErrorReport) => void): ErrorReport[] {
  if (typeof localStorage === 'undefined') return [];

  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return [];

  const queue: ErrorReport[] = JSON.parse(raw);
  localStorage.removeItem(LOCAL_STORAGE_KEY);

  if (forwardFn) {
    for (const report of queue) {
      try {
        forwardFn(report);
      } catch (err) {
        logger.error('[errorReporting] Failed to forward queued report:', err);
      }
    }
  }

  return queue;
}

/**
 * Get current queue size without flushing.
 */
export function getQueuedErrorCount(): number {
  if (typeof localStorage === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return 0;
    return JSON.parse(raw).length;
  } catch {
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap — wire up global handlers
// ─────────────────────────────────────────────────────────────────────────────

export function bootstrapErrorReporting(sentryDsn?: string): void {
  if (typeof window === 'undefined') return;

  // Firestore error listener (applies to all Firestore calls)
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const error = reason instanceof Error ? reason : new Error(String(reason));

    if (isFirestoreError(error)) {
      captureFirestoreError(error, 'unknown', {});
    } else if (isNetworkError(error)) {
      captureNetworkError(error, 'unknown', undefined, {});
    } else {
      captureUnhandledError(error, {});
    }
  });

  // Uncaught error global
  window.addEventListener('error', (event: ErrorEvent) => {
    captureUnhandledError(event.error || new Error(event.message), {});
  });

  // Flush any queued reports from prior sessions
  flushErrorQueue();

  // Sentry bootstrap stub — swap in real Sentry when DSN is configured
  if (sentryDsn) {
    logger.info('[errorReporting] Sentry DSN detected — initializing Sentry transport');
    setCaptureHandler?.((report: ErrorReport) => {
      // Replace this block with Sentry.captureException(error, { tags, user, extra })
      logger.debug('[errorReporting] Sentry report queued (bootstrap):', {
        type: report.type,
        message: report.message,
      });
    });
  }

  logger.info('[errorReporting] Bootstrap complete', {
    queued: getQueuedErrorCount(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isFirestoreError(error: Error): boolean {
  const code = (error as any).code || '';
  return (
    code.includes('permission-denied') ||
    code.includes('not-found') ||
    code.includes('already-exists') ||
    code.includes('resource-exhausted') ||
    code.includes('unavailable') ||
    code.includes('deadline-exceeded') ||
    code.includes('internal')
  );
}

function isNetworkError(error: Error): boolean {
  const msg = (error.message || '').toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('failed to fetch') ||
    msg.includes('internet') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('timeout')
  );
}

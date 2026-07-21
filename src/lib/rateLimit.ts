import { logger } from './env';

/**
 * Rate limiting utilities for 10K+ concurrent users
 * Uses in-memory store with optional Firestore persistence
 */

// In-memory rate limit store (per browser tab)
// For production, use Redis or Firestore with TTL
interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastAccess: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const RATE_LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  checkIn: { maxRequests: 5, windowMs: 60 * 1000 },      // 5 check-ins per minute
  manualAttendance: { maxRequests: 10, windowMs: 60 * 1000 }, // 10 manual marks per minute
  sessionCreate: { maxRequests: 3, windowMs: 60 * 1000 },      // 3 sessions per minute
  enrollment: { maxRequests: 5, windowMs: 60 * 1000 },          // 5 enrollments per minute
  feedback: { maxRequests: 3, windowMs: 5 * 60 * 1000 },        // 3 feedback per 5 minutes
  passwordChange: { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
  deviceReset: { maxRequests: 2, windowMs: 60 * 60 * 1000 },    // 2 per hour
  default: { maxRequests: 100, windowMs: 60 * 1000 },           // 100 per minute default
};

/**
 * Check if a request is allowed under rate limits
 * Returns { allowed: boolean, retryAfter?: number, remaining?: number }
 */
export function checkRateLimit(
  key: string,
  action: keyof typeof RATE_LIMITS = 'default'
): { allowed: boolean; retryAfter?: number; remaining: number } {
  const config = RATE_LIMITS[action];
  const now = Date.now();
  const storeKey = `${action}:${key}`;
  
  let entry = rateLimitStore.get(storeKey);
  
  // Clean up expired entries
  if (entry && entry.resetTime <= now) {
    rateLimitStore.delete(storeKey);
    entry = undefined;
  }
  
  if (!entry) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
      lastAccess: now,
    };
    rateLimitStore.set(storeKey, entry);
  }
  
  entry.count++;
  entry.lastAccess = now;
  
  const remaining = Math.max(0, config.maxRequests - entry.count);
  const allowed = entry.count <= config.maxRequests;
  
  if (!allowed) {
    const retryAfter = entry.resetTime - now;
    logger.warn(`Rate limit exceeded for ${storeKey}`, { 
      count: entry.count, 
      max: config.maxRequests,
      retryAfter 
    });
    return { allowed: false, retryAfter, remaining: 0 };
  }
  
  return { allowed: true, remaining };
}

/**
 * Get current rate limit status without incrementing
 */
export function getRateLimitStatus(
  key: string,
  action: keyof typeof RATE_LIMITS = 'default'
): { count: number; max: number; remaining: number; resetTime: number } | null {
  const config = RATE_LIMITS[action];
  const storeKey = `${action}:${key}`;
  const entry = rateLimitStore.get(storeKey);
  const now = Date.now();
  
  if (!entry || entry.resetTime <= now) {
    return { count: 0, max: config.maxRequests, remaining: config.maxRequests, resetTime: now + config.windowMs };
  }
  
  return {
    count: entry.count,
    max: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetTime: entry.resetTime,
  };
}

/**
 * Reset rate limit for a key (admin only)
 */
export function resetRateLimit(key: string, action?: keyof typeof RATE_LIMITS): void {
  if (action) {
    rateLimitStore.delete(`${action}:${key}`);
  } else {
    // Reset all actions for this key
    for (const a of Object.keys(RATE_LIMITS) as Array<keyof typeof RATE_LIMITS>) {
      rateLimitStore.delete(`${a}:${key}`);
    }
  }
}

// ============================================================
// REQUEST DEDUPLICATION
// ============================================================

const pendingRequests = new Map<string, Promise<any>>();

/**
 * Deduplicate identical requests made within a short time window
 * Returns the cached promise if a request with the same key is already in flight
 */
export function deduplicateRequest<T>(
  key: string,
  requestFn: () => Promise<T>,
  ttlMs: number = 5000
): Promise<T> {
  const existing = pendingRequests.get(key);
  if (existing) {
    logger.debug(`Deduplicating request: ${key}`);
    return existing as Promise<T>;
  }
  
  const promise = requestFn().finally(() => {
    // Clean up after TTL
    setTimeout(() => {
      pendingRequests.delete(key);
    }, ttlMs);
  });
  
  pendingRequests.set(key, promise);
  return promise;
}

/**
 * Clear a pending request deduplication key
 */
export function clearDeduplication(key: string): void {
  pendingRequests.delete(key);
}

// ============================================================
// RETRY WITH EXPONENTIAL BACKOFF
// ============================================================

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryableStatuses?: number[];
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableStatuses: [429, 500, 502, 503, 504],
  onRetry: () => {},
};

/**
 * Execute a function with exponential backoff retry
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if error is retryable
      const status = error?.response?.status || error?.code;
      const isRetryable = opts.retryableStatuses.includes(status);
      
      if (!isRetryable || attempt === opts.maxRetries) {
        throw error;
      }
      
      // Calculate delay with jitter
      const delay = Math.min(
        opts.baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
        opts.maxDelayMs
      );
      
      logger.warn(`Retry attempt ${attempt + 1}/${opts.maxRetries} after ${Math.round(delay)}ms`, {
        error: error.message,
        status,
      });
      
      opts.onRetry(attempt + 1, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// ============================================================
// BATCH OPERATIONS (for Firestore writes)
// ============================================================

export interface BatchOperation<T> {
  id: string;
  operation: () => Promise<T>;
  priority?: number; // Higher = more important
}

/**
 * Execute multiple operations in batches to avoid overwhelming Firestore
 */
export async function executeBatch<T>(
  operations: BatchOperation<T>[],
  options: {
    batchSize?: number;
    concurrency?: number;
    delayBetweenBatches?: number;
  } = {}
): Promise<T[]> {
  const {
    batchSize = 10,
    concurrency = 5,
    delayBetweenBatches = 100,
  } = options;
  
  // Sort by priority (highest first)
  const sorted = [...operations].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const results: T[] = [];
  
  for (let i = 0; i < sorted.length; i += batchSize) {
    const batch = sorted.slice(i, i + batchSize);
    
    // Execute batch with limited concurrency
    const batchResults = await Promise.all(
      batch.map(op => op.operation())
    );
    
    results.push(...batchResults);
    
    // Small delay between batches to avoid rate limits
    if (i + batchSize < sorted.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  return results;
}

// ============================================================
// CIRCUIT BREAKER
// ============================================================

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

export interface CircuitBreakerOptions {
  failureThreshold?: number;      // Number of failures before opening
  resetTimeoutMs?: number;        // Time before trying half-open
  halfOpenRequests?: number;      // Successful requests needed to close
}

/**
 * Circuit breaker pattern to prevent cascading failures
 */
export function withCircuitBreaker<T>(
  key: string,
  fn: () => Promise<T>,
  options: CircuitBreakerOptions = {}
): Promise<T> {
  const {
    failureThreshold = 5,
    resetTimeoutMs = 30000,
    halfOpenRequests = 3,
  } = options;
  
  let state = circuitBreakers.get(key) || {
    failures: 0,
    lastFailure: 0,
    state: 'closed' as const,
  };
  
  const now = Date.now();
  
  // Check if we should transition from open to half-open
  if (state.state === 'open' && now - state.lastFailure > resetTimeoutMs) {
    state.state = 'half-open';
    state.failures = 0;
  }
  
  // If open, reject immediately
  if (state.state === 'open') {
    throw new Error(`Circuit breaker open for ${key}`);
  }
  
  return fn()
    .then(result => {
      // Success - reset failures
      if (state.state === 'half-open') {
        state.failures++;
        if (state.failures >= halfOpenRequests) {
          state.state = 'closed';
          state.failures = 0;
        }
      } else {
        state.failures = 0;
      }
      circuitBreakers.set(key, state);
      return result;
    })
    .catch(error => {
      // Failure - increment counter
      state.failures++;
      state.lastFailure = now;
      
      if (state.failures >= failureThreshold) {
        state.state = 'open';
        logger.error(`Circuit breaker opened for ${key} after ${failureThreshold} failures`);
      }
      
      circuitBreakers.set(key, state);
      throw error;
    });
}

/**
 * Get circuit breaker status
 */
export function getCircuitBreakerStatus(key: string): CircuitBreakerState | null {
  return circuitBreakers.get(key) || null;
}

/**
 * Reset circuit breaker (admin only)
 */
export function resetCircuitBreaker(key: string): void {
  circuitBreakers.delete(key);
}
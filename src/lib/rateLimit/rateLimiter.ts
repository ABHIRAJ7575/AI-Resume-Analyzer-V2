/**
 * Sliding window rate limiter.
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.6
 *
 * Algorithm:
 *  1. Get current timestamp.
 *  2. Fetch all stored timestamps for the key that fall within [now - windowMs, now].
 *  3. If count >= maxRequests → deny and return retryAfterMs.
 *  4. Otherwise → record the new timestamp and allow.
 *  5. resetTime = oldest timestamp in window + windowMs  (or now + windowMs if empty).
 */

import { createRateLimitStore, type RateLimitStore } from './rateLimitStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Window size in milliseconds (e.g. 3_600_000 for 1 hour). */
  windowMs: number;
  /** Maximum number of requests allowed within the window. */
  maxRequests: number;
  /** Optional prefix for store keys (avoids collisions between limiters). */
  keyPrefix?: string;
}

export interface RateLimitResult {
  /** Whether the request is allowed. */
  allowed: boolean;
  /** Requests remaining in the current window. */
  remaining: number;
  /** When the oldest in-window request will expire (window resets). */
  resetTime: Date;
  /** Milliseconds to wait before retrying (only set when allowed === false). */
  retryAfterMs?: number;
}

// ─── Pre-configured limiters ──────────────────────────────────────────────────

/** Free tier: 5 analyses per hour per user (Requirement 9.1). */
export const FREE_TIER_LIMITER: RateLimitConfig = {
  windowMs: 3_600_000,
  maxRequests: 5,
  keyPrefix: 'free',
};

/** Premium tier: 50 analyses per hour per user (Requirement 9.2). */
export const PREMIUM_TIER_LIMITER: RateLimitConfig = {
  windowMs: 3_600_000,
  maxRequests: 50,
  keyPrefix: 'premium',
};

/** IP-based limiter: 10 requests per minute for unauthenticated endpoints (Requirement 9.6). */
export const IP_LIMITER: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 10,
  keyPrefix: 'ip',
};

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Check whether `identifier` is within the rate limit defined by `config`.
 *
 * @param identifier - A userId or IP address.
 * @param config     - The rate limit configuration to apply.
 * @param store      - Optional store override (defaults to the module-level store).
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
  store?: RateLimitStore,
): Promise<RateLimitResult> {
  const s = store ?? createRateLimitStore();
  const key = config.keyPrefix ? `${config.keyPrefix}:${identifier}` : identifier;
  const now = Date.now();

  // Step 2: get timestamps within the window
  const inWindow = await s.getRequests(key, config.windowMs);
  const count = inWindow.length;

  // Step 5: compute resetTime from the oldest in-window timestamp
  const oldest = inWindow.length > 0 ? Math.min(...inWindow) : now;
  const resetTime = new Date(oldest + config.windowMs);

  if (count >= config.maxRequests) {
    // Step 4: deny
    const retryAfterMs = resetTime.getTime() - now;
    return {
      allowed: false,
      remaining: 0,
      resetTime,
      retryAfterMs: Math.max(0, retryAfterMs),
    };
  }

  // Step 4: allow — record the new request
  await s.addRequest(key, now);

  return {
    allowed: true,
    remaining: config.maxRequests - count - 1,
    resetTime,
  };
}

// ─── Class wrapper ────────────────────────────────────────────────────────────

/**
 * Object-oriented wrapper around `checkRateLimit`.
 * Holds a fixed config and optional store so callers don't repeat themselves.
 */
export class RateLimiter {
  constructor(
    private readonly config: RateLimitConfig,
    private readonly store?: RateLimitStore,
  ) {}

  check(identifier: string): Promise<RateLimitResult> {
    return checkRateLimit(identifier, this.config, this.store);
  }
}

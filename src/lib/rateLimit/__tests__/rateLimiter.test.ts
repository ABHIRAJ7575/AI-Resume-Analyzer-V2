/**
 * Unit tests for rateLimiter.ts
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.6
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkRateLimit,
  RateLimiter,
  FREE_TIER_LIMITER,
  PREMIUM_TIER_LIMITER,
  IP_LIMITER,
  type RateLimitConfig,
} from '../rateLimiter';
import { InMemoryRateLimitStore } from '../rateLimitStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Create a fresh isolated store for each test. */
function freshStore() {
  return new InMemoryRateLimitStore();
}

/** Fire `n` requests through checkRateLimit and return all results. */
async function fireRequests(
  n: number,
  identifier: string,
  config: RateLimitConfig,
  store: InMemoryRateLimitStore,
) {
  const results = [];
  for (let i = 0; i < n; i++) {
    results.push(await checkRateLimit(identifier, config, store));
  }
  return results;
}

// ─── checkRateLimit ───────────────────────────────────────────────────────────

describe('checkRateLimit()', () => {
  it('allows a request when under the limit', async () => {
    const store = freshStore();
    const config: RateLimitConfig = { windowMs: 60_000, maxRequests: 3 };

    const result = await checkRateLimit('user-1', config, store);

    expect(result.allowed).toBe(true);
  });

  it('blocks a request when at the limit', async () => {
    const store = freshStore();
    const config: RateLimitConfig = { windowMs: 60_000, maxRequests: 3 };

    // Exhaust the limit
    await fireRequests(3, 'user-1', config, store);

    const result = await checkRateLimit('user-1', config, store);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('returns correct remaining count', async () => {
    const store = freshStore();
    const config: RateLimitConfig = { windowMs: 60_000, maxRequests: 5 };

    const first = await checkRateLimit('user-1', config, store);
    expect(first.remaining).toBe(4); // 5 - 1 = 4

    const second = await checkRateLimit('user-1', config, store);
    expect(second.remaining).toBe(3); // 5 - 2 = 3

    const third = await checkRateLimit('user-1', config, store);
    expect(third.remaining).toBe(2); // 5 - 3 = 2
  });

  it('uses sliding window — old requests outside the window do not count', async () => {
    const store = freshStore();
    // Very short window: 100 ms
    const config: RateLimitConfig = { windowMs: 100, maxRequests: 2 };

    // Fill the window
    await fireRequests(2, 'user-1', config, store);

    // Wait for the window to expire
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Should be allowed again because old timestamps are outside the window
    const result = await checkRateLimit('user-1', config, store);
    expect(result.allowed).toBe(true);
  });

  it('returns a resetTime in the future', async () => {
    const store = freshStore();
    const config: RateLimitConfig = { windowMs: 60_000, maxRequests: 5 };
    const before = Date.now();

    const result = await checkRateLimit('user-1', config, store);

    expect(result.resetTime).toBeInstanceOf(Date);
    expect(result.resetTime.getTime()).toBeGreaterThan(before);
  });

  it('returns retryAfterMs when blocked', async () => {
    const store = freshStore();
    const config: RateLimitConfig = { windowMs: 60_000, maxRequests: 2 };

    await fireRequests(2, 'user-1', config, store);

    const result = await checkRateLimit('user-1', config, store);

    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeDefined();
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it('does not set retryAfterMs when allowed', async () => {
    const store = freshStore();
    const config: RateLimitConfig = { windowMs: 60_000, maxRequests: 5 };

    const result = await checkRateLimit('user-1', config, store);

    expect(result.allowed).toBe(true);
    expect(result.retryAfterMs).toBeUndefined();
  });

  it('isolates different identifiers', async () => {
    const store = freshStore();
    const config: RateLimitConfig = { windowMs: 60_000, maxRequests: 1 };

    // Exhaust user-1
    await checkRateLimit('user-1', config, store);
    const user1Blocked = await checkRateLimit('user-1', config, store);

    // user-2 should still be allowed
    const user2Result = await checkRateLimit('user-2', config, store);

    expect(user1Blocked.allowed).toBe(false);
    expect(user2Result.allowed).toBe(true);
  });
});

// ─── Free tier ────────────────────────────────────────────────────────────────

describe('FREE_TIER_LIMITER', () => {
  it('allows exactly 5 requests and blocks the 6th', async () => {
    const store = freshStore();

    const results = await fireRequests(6, 'free-user', FREE_TIER_LIMITER, store);

    // First 5 should be allowed
    for (let i = 0; i < 5; i++) {
      expect(results[i]!.allowed).toBe(true);
    }
    // 6th should be blocked
    expect(results[5]!.allowed).toBe(false);
    expect(results[5]!.remaining).toBe(0);
  });

  it('has a 1-hour window', () => {
    expect(FREE_TIER_LIMITER.windowMs).toBe(3_600_000);
  });

  it('has maxRequests of 5', () => {
    expect(FREE_TIER_LIMITER.maxRequests).toBe(5);
  });
});

// ─── Premium tier ─────────────────────────────────────────────────────────────

describe('PREMIUM_TIER_LIMITER', () => {
  it('allows 50 requests and blocks the 51st', async () => {
    const store = freshStore();

    const results = await fireRequests(51, 'premium-user', PREMIUM_TIER_LIMITER, store);

    // First 50 should be allowed
    for (let i = 0; i < 50; i++) {
      expect(results[i]!.allowed).toBe(true);
    }
    // 51st should be blocked
    expect(results[50]!.allowed).toBe(false);
  });

  it('has a 1-hour window', () => {
    expect(PREMIUM_TIER_LIMITER.windowMs).toBe(3_600_000);
  });

  it('has maxRequests of 50', () => {
    expect(PREMIUM_TIER_LIMITER.maxRequests).toBe(50);
  });
});

// ─── IP limiter ───────────────────────────────────────────────────────────────

describe('IP_LIMITER', () => {
  it('allows 10 requests per minute and blocks the 11th', async () => {
    const store = freshStore();

    const results = await fireRequests(11, '192.168.1.1', IP_LIMITER, store);

    for (let i = 0; i < 10; i++) {
      expect(results[i]!.allowed).toBe(true);
    }
    expect(results[10]!.allowed).toBe(false);
  });

  it('has a 1-minute window', () => {
    expect(IP_LIMITER.windowMs).toBe(60_000);
  });

  it('has maxRequests of 10', () => {
    expect(IP_LIMITER.maxRequests).toBe(10);
  });
});

// ─── RateLimiter class ────────────────────────────────────────────────────────

describe('RateLimiter class', () => {
  it('delegates to checkRateLimit correctly', async () => {
    const store = freshStore();
    const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 3 }, store);

    const result = await limiter.check('user-1');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('blocks after limit is reached', async () => {
    const store = freshStore();
    const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 2 }, store);

    await limiter.check('user-1');
    await limiter.check('user-1');
    const blocked = await limiter.check('user-1');

    expect(blocked.allowed).toBe(false);
  });
});

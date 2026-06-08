/**
 * Quota tracking and reset logic.
 * Requirements: 9.5
 *
 * Quota limits:
 *   free       →   5 analyses / hour
 *   premium    →  50 analyses / hour
 *   enterprise → 1000 analyses / hour (effectively unlimited)
 *
 * Reset date: 1 hour from the first use within the current period
 * (or the stored reset time if one already exists).
 */

import { createRateLimitStore, type RateLimitStore } from './rateLimitStore';

// ─── Constants ────────────────────────────────────────────────────────────────

const QUOTA_LIMITS: Record<'free' | 'premium' | 'enterprise', number> = {
  free: 5,
  premium: 50,
  enterprise: 1000,
};

const QUOTA_WINDOW_MS = 3_600_000; // 1 hour

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuotaInfo {
  tier: 'free' | 'premium' | 'enterprise';
  used: number;
  limit: number;
  remaining: number;
  resetDate: Date;
  isExhausted: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function quotaKey(userId: string): string {
  return `quota:${userId}`;
}

function resetKey(userId: string): string {
  return `quota-reset:${userId}`;
}

/**
 * Resolve the reset date for a user.
 * If no reset time is stored yet, set it to now + 1 hour and persist it.
 */
async function resolveResetDate(userId: string, store: RateLimitStore): Promise<Date> {
  const stored = await store.getResetTime(resetKey(userId));
  if (stored !== null) {
    return stored;
  }
  const newReset = new Date(Date.now() + QUOTA_WINDOW_MS);
  await store.setResetTime(resetKey(userId), newReset);
  return newReset;
}

/**
 * If the stored reset time has passed, clear quota and reset time so the
 * next call starts a fresh window.
 */
async function maybeResetExpiredQuota(userId: string, store: RateLimitStore): Promise<void> {
  const stored = await store.getResetTime(resetKey(userId));
  if (stored !== null && Date.now() >= stored.getTime()) {
    await store.setQuotaUsed(quotaKey(userId), 0);
    await store.setResetTime(resetKey(userId), new Date(Date.now() + QUOTA_WINDOW_MS));
  }
}

// ─── Core functions ───────────────────────────────────────────────────────────

/**
 * Return the current quota information for a user.
 */
export async function getQuotaInfo(
  userId: string,
  tier: 'free' | 'premium' | 'enterprise',
  store?: RateLimitStore,
): Promise<QuotaInfo> {
  const s = store ?? createRateLimitStore();

  await maybeResetExpiredQuota(userId, s);

  const limit = QUOTA_LIMITS[tier];
  const used = await s.getQuotaUsed(quotaKey(userId));
  const resetDate = await resolveResetDate(userId, s);
  const remaining = Math.max(0, limit - used);

  return {
    tier,
    used,
    limit,
    remaining,
    resetDate,
    isExhausted: used >= limit,
  };
}

/**
 * Increment the quota counter for a user and return the updated QuotaInfo.
 */
export async function incrementQuota(
  userId: string,
  tier: 'free' | 'premium' | 'enterprise',
  store?: RateLimitStore,
): Promise<QuotaInfo> {
  const s = store ?? createRateLimitStore();

  await maybeResetExpiredQuota(userId, s);

  const current = await s.getQuotaUsed(quotaKey(userId));
  const newCount = current + 1;
  await s.setQuotaUsed(quotaKey(userId), newCount);

  // Ensure a reset date exists
  await resolveResetDate(userId, s);

  return getQuotaInfo(userId, tier, s);
}

/**
 * Reset the quota counter for a user to zero and clear the reset time
 * so the next call starts a fresh window.
 */
export async function resetQuota(userId: string, store?: RateLimitStore): Promise<void> {
  const s = store ?? createRateLimitStore();
  await s.setQuotaUsed(quotaKey(userId), 0);
  // Clear the reset time so resolveResetDate will create a new one on next use
  await s.setResetTime(resetKey(userId), new Date(Date.now() + QUOTA_WINDOW_MS));
}

// ─── Class wrapper ────────────────────────────────────────────────────────────

/**
 * Object-oriented wrapper around the quota functions.
 */
export class QuotaManager {
  constructor(private readonly store?: RateLimitStore) {}

  getQuotaInfo(
    userId: string,
    tier: 'free' | 'premium' | 'enterprise',
  ): Promise<QuotaInfo> {
    return getQuotaInfo(userId, tier, this.store);
  }

  incrementQuota(
    userId: string,
    tier: 'free' | 'premium' | 'enterprise',
  ): Promise<QuotaInfo> {
    return incrementQuota(userId, tier, this.store);
  }

  resetQuota(userId: string): Promise<void> {
    return resetQuota(userId, this.store);
  }
}

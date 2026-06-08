/**
 * Unit tests for quotaManager.ts
 * Requirements: 9.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getQuotaInfo,
  incrementQuota,
  resetQuota,
  QuotaManager,
} from '../quotaManager';
import { InMemoryRateLimitStore } from '../rateLimitStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function freshStore() {
  return new InMemoryRateLimitStore();
}

// ─── getQuotaInfo ─────────────────────────────────────────────────────────────

describe('getQuotaInfo()', () => {
  it('returns correct quota for free tier (limit = 5)', async () => {
    const store = freshStore();

    const info = await getQuotaInfo('user-1', 'free', store);

    expect(info.tier).toBe('free');
    expect(info.limit).toBe(5);
    expect(info.used).toBe(0);
    expect(info.remaining).toBe(5);
    expect(info.isExhausted).toBe(false);
    expect(info.resetDate).toBeInstanceOf(Date);
    expect(info.resetDate.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns correct quota for premium tier (limit = 50)', async () => {
    const store = freshStore();

    const info = await getQuotaInfo('user-2', 'premium', store);

    expect(info.tier).toBe('premium');
    expect(info.limit).toBe(50);
    expect(info.used).toBe(0);
    expect(info.remaining).toBe(50);
    expect(info.isExhausted).toBe(false);
  });

  it('returns correct quota for enterprise tier (limit = 1000)', async () => {
    const store = freshStore();

    const info = await getQuotaInfo('user-3', 'enterprise', store);

    expect(info.tier).toBe('enterprise');
    expect(info.limit).toBe(1000);
    expect(info.remaining).toBe(1000);
    expect(info.isExhausted).toBe(false);
  });

  it('reflects previously incremented usage', async () => {
    const store = freshStore();

    await incrementQuota('user-1', 'free', store);
    await incrementQuota('user-1', 'free', store);

    const info = await getQuotaInfo('user-1', 'free', store);

    expect(info.used).toBe(2);
    expect(info.remaining).toBe(3);
  });
});

// ─── incrementQuota ───────────────────────────────────────────────────────────

describe('incrementQuota()', () => {
  it('increases the used count by 1', async () => {
    const store = freshStore();

    const before = await getQuotaInfo('user-1', 'free', store);
    expect(before.used).toBe(0);

    await incrementQuota('user-1', 'free', store);

    const after = await getQuotaInfo('user-1', 'free', store);
    expect(after.used).toBe(1);
    expect(after.remaining).toBe(4);
  });

  it('marks quota as exhausted when limit is reached', async () => {
    const store = freshStore();

    // Increment 5 times to reach the free tier limit
    for (let i = 0; i < 5; i++) {
      await incrementQuota('user-1', 'free', store);
    }

    const info = await getQuotaInfo('user-1', 'free', store);

    expect(info.used).toBe(5);
    expect(info.remaining).toBe(0);
    expect(info.isExhausted).toBe(true);
  });

  it('returns updated QuotaInfo after increment', async () => {
    const store = freshStore();

    const result = await incrementQuota('user-1', 'premium', store);

    expect(result.used).toBe(1);
    expect(result.remaining).toBe(49);
    expect(result.isExhausted).toBe(false);
  });

  it('increments independently for different users', async () => {
    const store = freshStore();

    await incrementQuota('user-1', 'free', store);
    await incrementQuota('user-1', 'free', store);
    await incrementQuota('user-2', 'free', store);

    const info1 = await getQuotaInfo('user-1', 'free', store);
    const info2 = await getQuotaInfo('user-2', 'free', store);

    expect(info1.used).toBe(2);
    expect(info2.used).toBe(1);
  });
});

// ─── resetQuota ───────────────────────────────────────────────────────────────

describe('resetQuota()', () => {
  it('resets used count to 0', async () => {
    const store = freshStore();

    // Use up some quota
    await incrementQuota('user-1', 'free', store);
    await incrementQuota('user-1', 'free', store);
    await incrementQuota('user-1', 'free', store);

    const before = await getQuotaInfo('user-1', 'free', store);
    expect(before.used).toBe(3);

    await resetQuota('user-1', store);

    const after = await getQuotaInfo('user-1', 'free', store);
    expect(after.used).toBe(0);
    expect(after.remaining).toBe(5);
    expect(after.isExhausted).toBe(false);
  });

  it('allows new increments after reset', async () => {
    const store = freshStore();

    // Exhaust quota
    for (let i = 0; i < 5; i++) {
      await incrementQuota('user-1', 'free', store);
    }

    await resetQuota('user-1', store);
    await incrementQuota('user-1', 'free', store);

    const info = await getQuotaInfo('user-1', 'free', store);
    expect(info.used).toBe(1);
    expect(info.isExhausted).toBe(false);
  });
});

// ─── QuotaManager class ───────────────────────────────────────────────────────

describe('QuotaManager class', () => {
  it('getQuotaInfo delegates correctly', async () => {
    const store = freshStore();
    const manager = new QuotaManager(store);

    const info = await manager.getQuotaInfo('user-1', 'free');

    expect(info.tier).toBe('free');
    expect(info.limit).toBe(5);
    expect(info.used).toBe(0);
  });

  it('incrementQuota delegates correctly', async () => {
    const store = freshStore();
    const manager = new QuotaManager(store);

    const result = await manager.incrementQuota('user-1', 'premium');

    expect(result.used).toBe(1);
    expect(result.remaining).toBe(49);
  });

  it('resetQuota delegates correctly', async () => {
    const store = freshStore();
    const manager = new QuotaManager(store);

    await manager.incrementQuota('user-1', 'free');
    await manager.incrementQuota('user-1', 'free');
    await manager.resetQuota('user-1');

    const info = await manager.getQuotaInfo('user-1', 'free');
    expect(info.used).toBe(0);
  });

  it('all three methods share the same store', async () => {
    const store = freshStore();
    const manager = new QuotaManager(store);

    await manager.incrementQuota('user-1', 'free');
    await manager.incrementQuota('user-1', 'free');

    const info = await manager.getQuotaInfo('user-1', 'free');
    expect(info.used).toBe(2);

    await manager.resetQuota('user-1');

    const afterReset = await manager.getQuotaInfo('user-1', 'free');
    expect(afterReset.used).toBe(0);
  });
});

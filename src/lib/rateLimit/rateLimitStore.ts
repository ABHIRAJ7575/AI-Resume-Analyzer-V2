/**
 * In-memory sliding window rate limit store.
 * Requirements: 9.4
 *
 * Implements the RateLimitStore interface using plain Maps so it can be
 * swapped for a Redis-backed implementation without changing callers.
 */

// ─── Interface ────────────────────────────────────────────────────────────────

/**
 * Abstraction for a rate-limit backing store.
 * The default implementation is in-memory (Map-based).
 * This interface can be swapped for a Redis-backed implementation (Requirement 9.4).
 */
export interface RateLimitStore {
  /** Record a request timestamp for a key. */
  addRequest(key: string, timestamp: number): Promise<void>;
  /** Get all request timestamps within the sliding window. */
  getRequests(key: string, windowMs: number): Promise<number[]>;
  /** Clear all request timestamps for a key (used on quota reset). */
  clearRequests(key: string): Promise<void>;
  /** Get the number of quota units consumed for a key. */
  getQuotaUsed(key: string): Promise<number>;
  /** Set the number of quota units consumed for a key. */
  setQuotaUsed(key: string, count: number): Promise<void>;
  /** Get the quota reset time for a key, or null if not set. */
  getResetTime(key: string): Promise<Date | null>;
  /** Set the quota reset time for a key. */
  setResetTime(key: string, resetTime: Date): Promise<void>;
}

// ─── In-memory implementation ─────────────────────────────────────────────────

/**
 * In-memory RateLimitStore backed by plain Maps.
 *
 * - `requestTimestamps`: Map<key, number[]> — sliding window timestamps
 * - `quotaUsed`:         Map<key, number>   — quota consumption counters
 * - `resetTimes`:        Map<key, Date>     — quota reset dates
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly requestTimestamps = new Map<string, number[]>();
  private readonly quotaUsed = new Map<string, number>();
  private readonly resetTimes = new Map<string, Date>();

  async addRequest(key: string, timestamp: number): Promise<void> {
    const existing = this.requestTimestamps.get(key) ?? [];
    existing.push(timestamp);
    this.requestTimestamps.set(key, existing);
  }

  async getRequests(key: string, windowMs: number): Promise<number[]> {
    const all = this.requestTimestamps.get(key) ?? [];
    const cutoff = Date.now() - windowMs;
    // Filter to only timestamps within the window and update the stored list
    const inWindow = all.filter((ts) => ts > cutoff);
    this.requestTimestamps.set(key, inWindow);
    return inWindow;
  }

  async clearRequests(key: string): Promise<void> {
    this.requestTimestamps.delete(key);
  }

  async getQuotaUsed(key: string): Promise<number> {
    return this.quotaUsed.get(key) ?? 0;
  }

  async setQuotaUsed(key: string, count: number): Promise<void> {
    this.quotaUsed.set(key, count);
  }

  async getResetTime(key: string): Promise<Date | null> {
    return this.resetTimes.get(key) ?? null;
  }

  async setResetTime(key: string, resetTime: Date): Promise<void> {
    this.resetTimes.set(key, resetTime);
  }
}

// ─── Module-level singleton ───────────────────────────────────────────────────

let activeStore: RateLimitStore = new InMemoryRateLimitStore();

/**
 * Replace the active store implementation.
 * Useful for injecting a Redis-backed store in production (Requirement 9.4).
 */
export function setRateLimitStore(store: RateLimitStore): void {
  activeStore = store;
}

/**
 * Return the currently active store.
 */
export function getRateLimitStore(): RateLimitStore {
  return activeStore;
}

/**
 * Factory function — returns the active store instance.
 * Mirrors the pattern used by the embedding cache.
 */
export function createRateLimitStore(): RateLimitStore {
  return activeStore;
}

/**
 * Embedding generation service using the Hugging Face Inference API.
 * Requirements: 3.1, 12.2, 12.3
 */

import { LLMError } from '@/types/errors';

// ─── Constants ────────────────────────────────────────────────────────────────

const EMBEDDING_DIMENSIONS = 384;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const REQUEST_TIMEOUT_MS = 30_000; // 30 seconds

// ─── EmbeddingCache interface ─────────────────────────────────────────────────

/**
 * Abstraction for an embedding cache.
 * The default implementation is an in-memory Map with TTL.
 * This interface can be swapped for a Redis-backed implementation (Requirement 12.2).
 */
export interface EmbeddingCache {
  get(key: string): number[] | undefined;
  set(key: string, value: number[]): void;
  clear(): void;
}

// ─── In-memory cache implementation ──────────────────────────────────────────

interface CacheEntry {
  value: number[];
  expiresAt: number;
}

class InMemoryEmbeddingCache implements EmbeddingCache {
  private readonly store = new Map<string, CacheEntry>();

  get(key: string): number[] | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: number[]): void {
    this.store.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  clear(): void {
    this.store.clear();
  }
}

// ─── Module-level cache instance ─────────────────────────────────────────────

let activeCache: EmbeddingCache = new InMemoryEmbeddingCache();

/**
 * Replace the active cache implementation.
 * Useful for injecting a Redis-backed cache in production (Requirement 12.2).
 */
export function setEmbeddingCache(cache: EmbeddingCache): void {
  activeCache = cache;
}

/**
 * Clear all entries from the active cache.
 * Primarily intended for use in tests (Requirement 12.3).
 */
export function clearEmbeddingCache(): void {
  activeCache.clear();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute a SHA-256 hash of the input text and return it as a hex string.
 * Used as the cache key so that semantically identical texts share a cache entry.
 */
async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Perform mean pooling over a 2-D embedding matrix (token × dimension).
 * Returns a 1-D vector of length equal to the number of dimensions.
 */
function meanPool(matrix: number[][]): number[] {
  if (matrix.length === 0) return [];
  const dims = matrix[0]?.length ?? 0;
  const result = new Array<number>(dims).fill(0);
  for (const row of matrix) {
    for (let i = 0; i < dims; i++) {
      result[i] = (result[i] ?? 0) + (row[i] ?? 0);
    }
  }
  return result.map((v) => v / matrix.length);
}

/**
 * Clamp a value to [-1, 1] to absorb minor floating-point precision drift.
 */
function clamp(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

/**
 * Validate and normalise a raw HF API response into a 384-dimensional vector.
 * HF returns either `number[]` (flat) or `number[][]` (nested / token-level).
 */
function normaliseEmbedding(raw: unknown): number[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new LLMError('Hugging Face API returned an unexpected embedding shape.');
  }

  let flat: number[];

  if (typeof raw[0] === 'number') {
    // Already a flat vector
    flat = raw as number[];
  } else if (Array.isArray(raw[0])) {
    // Nested (token-level) — apply mean pooling
    flat = meanPool(raw as number[][]);
  } else {
    throw new LLMError('Hugging Face API returned an unexpected embedding type.');
  }

  if (flat.length !== EMBEDDING_DIMENSIONS) {
    throw new LLMError(
      `Expected embedding of ${EMBEDDING_DIMENSIONS} dimensions, got ${flat.length}.`,
    );
  }

  // Clamp values to [-1, 1] to handle minor float precision drift
  return flat.map(clamp);
}

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Generate a 384-dimensional embedding for the given text.
 *
 * - On cache hit: returns the cached embedding (Requirement 12.3).
 * - On cache miss: calls the Hugging Face Inference API, caches the result,
 *   and returns the embedding (Requirement 3.1).
 *
 * @throws {LLMError} on API failure, timeout, or unexpected response shape.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env['HF_API_KEY'];
  const model = process.env['HF_EMBEDDING_MODEL'] ?? 'sentence-transformers/all-MiniLM-L6-v2';

  if (!apiKey) {
    throw new LLMError('HF_API_KEY environment variable is not set.');
  }

  // ── Cache lookup (Requirement 12.3) ────────────────────────────────────────
  const cacheKey = await hashText(text);
  const cached = activeCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  // ── API call ───────────────────────────────────────────────────────────────
  const url = `https://router.huggingface.co/hf-inference/models/${model}/pipeline/feature-extraction`;
  const body = JSON.stringify({ inputs: text, options: { wait_for_model: true } });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new LLMError(`Hugging Face API request timed out after ${REQUEST_TIMEOUT_MS}ms.`, err);
    }
    throw new LLMError('Hugging Face API network request failed.', err);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new LLMError(
      `Hugging Face API returned status ${response.status}: ${response.statusText}. ${body}`.trim(),
    );
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (err) {
    throw new LLMError('Failed to parse Hugging Face API response as JSON.', err);
  }

  const embedding = normaliseEmbedding(raw);

  // ── Cache store (Requirement 12.2) ─────────────────────────────────────────
  activeCache.set(cacheKey, embedding);

  return embedding;
}

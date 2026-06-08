/**
 * Property-based tests for generateEmbedding().
 *
 * **Validates: Requirements 3.1**
 *
 * Property 4 — Embedding Dimension Consistency:
 *   ∀ embedding: number[],
 *     embedding.length = 384 ∧
 *     ∀ value ∈ embedding: -1 ≤ value ≤ 1
 *
 * For any non-empty text input, generateEmbedding() must always return an
 * array of exactly 384 numbers, each in the range [-1, 1].
 *
 * Sub-properties tested:
 *   1. Dimension Consistency  — result always has exactly 384 elements
 *   2. Value Range            — every element is in [-1, 1]
 *   3. Clamping               — values slightly outside [-1, 1] in the API
 *                               response are clamped to the valid range
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { generateEmbedding, clearEmbeddingCache } from '../embeddingService';

// ─── Constants ────────────────────────────────────────────────────────────────

const DIMS = 384;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a mock fetch Response wrapping any JSON-serialisable body. */
function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  process.env['HF_API_KEY'] = 'test-hf-key';
  process.env['HF_EMBEDDING_MODEL'] = 'sentence-transformers/all-MiniLM-L6-v2';
  clearEmbeddingCache();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  clearEmbeddingCache();
});

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * Generates a valid 384-dimensional flat embedding where every value is in
 * [-1, 1] — simulates a well-formed Hugging Face API response.
 */
const validEmbeddingArb = fc.array(
  fc.double({ min: -1, max: 1, noNaN: true }),
  { minLength: DIMS, maxLength: DIMS },
);

/**
 * Generates a 384-dimensional flat embedding where a random subset of values
 * are slightly outside [-1, 1] (e.g. 1.0000001 or -1.0000001) — simulates
 * minor floating-point precision drift from the API.
 */
const embeddingWithOutliersArb = fc
  .tuple(
    fc.array(fc.double({ min: -1, max: 1, noNaN: true }), {
      minLength: DIMS,
      maxLength: DIMS,
    }),
    // Pick a few indices to push slightly out of range
    fc.array(fc.integer({ min: 0, max: DIMS - 1 }), { minLength: 1, maxLength: 10 }),
    fc.boolean(), // true → push above 1, false → push below -1
  )
  .map(([base, indices, pushHigh]) => {
    const result = [...base];
    for (const idx of indices) {
      result[idx] = pushHigh ? 1.0000001 : -1.0000001;
    }
    return result;
  });

/** Any non-empty string as text input to generateEmbedding. */
const nonEmptyTextArb = fc.string({ minLength: 1 });

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('generateEmbedding() — Property 4: Embedding Dimension Consistency', () => {
  /**
   * Property 4.1 — Dimension Consistency:
   *   For any non-empty string, the returned embedding always has exactly 384
   *   dimensions.
   *
   * **Validates: Requirements 3.1**
   */
  it('always returns exactly 384 dimensions for any non-empty text input', async () => {
    await fc.assert(
      fc.asyncProperty(nonEmptyTextArb, validEmbeddingArb, async (text, apiEmbedding) => {
        // Clear cache before each run so the mock is always called
        clearEmbeddingCache();

        const fetchMock = vi.mocked(fetch);
        fetchMock.mockResolvedValueOnce(mockResponse(apiEmbedding));

        const result = await generateEmbedding(text);

        expect(result).toHaveLength(DIMS);
      }),
      { numRuns: 50 },
    );
  });

  /**
   * Property 4.2 — Value Range:
   *   Every value in the returned embedding is in [-1, 1].
   *
   * **Validates: Requirements 3.1**
   */
  it('every value in the returned embedding is in [-1, 1]', async () => {
    await fc.assert(
      fc.asyncProperty(nonEmptyTextArb, validEmbeddingArb, async (text, apiEmbedding) => {
        clearEmbeddingCache();

        const fetchMock = vi.mocked(fetch);
        fetchMock.mockResolvedValueOnce(mockResponse(apiEmbedding));

        const result = await generateEmbedding(text);

        for (const value of result) {
          expect(value).toBeGreaterThanOrEqual(-1);
          expect(value).toBeLessThanOrEqual(1);
        }
      }),
      { numRuns: 50 },
    );
  }, 30_000);

  /**
   * Property 4.3 — Clamping:
   *   Values slightly outside [-1, 1] in the API response are clamped to the
   *   valid range. The result still has exactly 384 dimensions and every value
   *   is in [-1, 1].
   *
   * **Validates: Requirements 3.1**
   */
  it('clamps values slightly outside [-1, 1] and still returns 384 valid dimensions', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonEmptyTextArb,
        embeddingWithOutliersArb,
        async (text, apiEmbeddingWithOutliers) => {
          clearEmbeddingCache();

          const fetchMock = vi.mocked(fetch);
          fetchMock.mockResolvedValueOnce(mockResponse(apiEmbeddingWithOutliers));

          const result = await generateEmbedding(text);

          // Dimension must still be exactly 384
          expect(result).toHaveLength(DIMS);

          // Every value must be clamped to [-1, 1]
          for (const value of result) {
            expect(value).toBeGreaterThanOrEqual(-1);
            expect(value).toBeLessThanOrEqual(1);
          }
        },
      ),
      { numRuns: 50 },
    );
  }, 30_000);
});

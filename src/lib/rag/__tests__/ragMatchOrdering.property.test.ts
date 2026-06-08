/**
 * Property-based tests for RAG match ordering.
 *
 * **Validates: Requirements 3.5**
 *
 * Property 3 — RAG Match Ordering:
 *   ∀ analysis: ResumeAnalysis,
 *     ∀ i, j: 0 ≤ i < j < analysis.ragMatches.length ⟹
 *       analysis.ragMatches[i].score ≥ analysis.ragMatches[j].score
 *
 * RAG matches returned by `semanticSearch` must always be sorted by similarity
 * score in descending order.
 *
 * Sub-properties tested:
 *   1. Match Ordering       — semanticSearch returns matches sorted by score descending
 *   2. Ordering Preserved   — calculateCosineSimilarity does not mutate/reorder the input array
 *   3. Score Bounds         — calculateCosineSimilarity always returns a value in [0, 100]
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { VectorRAGLayer, calculateCosineSimilarity } from '../vectorSearch';
import type { RAGMatch } from '@/types';
import type { PineconeClient } from '../pineconeClient';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../embeddingService', () => ({
  generateEmbedding: vi.fn(),
}));

import { generateEmbedding } from '../embeddingService';

const mockGenerateEmbedding = vi.mocked(generateEmbedding);

// ─── Constants ────────────────────────────────────────────────────────────────

const FAKE_EMBEDDING = new Array<number>(384).fill(0.1);

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockGenerateEmbedding.mockResolvedValue(FAKE_EMBEDDING);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * Generates an array of RAGMatch objects with scores in [0, 1].
 * The array is sorted by score descending before use, simulating what
 * PineconeClient returns (already sorted by the vector DB).
 */
const ragMatchArrayArb = fc
  .array(
    fc.record({
      id: fc.uuid(),
      score: fc.double({ min: 0, max: 1, noNaN: true }),
      metadata: fc.record({
        resumeType: fc.string(),
        industryTag: fc.string(),
        qualityRating: fc.double({ min: 0, max: 1, noNaN: true }),
      }),
      text: fc.string(),
    }),
    { minItems: 0, maxItems: 10 },
  )
  .map((matches) =>
    // Sort descending by score — simulates what PineconeClient returns
    [...matches].sort((a, b) => b.score - a.score),
  );

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Create a mock PineconeClient whose query() resolves to the given matches. */
function makeMockPineconeClient(matches: RAGMatch[]): PineconeClient {
  return {
    query: vi.fn().mockResolvedValue(matches),
    upsert: vi.fn(),
  } as unknown as PineconeClient;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RAG Match Ordering — Property 3', () => {
  /**
   * Property 3.1 — Match Ordering:
   *   For any array of RAGMatch objects (pre-sorted descending by score, as
   *   returned by PineconeClient), semanticSearch returns them sorted by score
   *   descending.
   *
   * **Validates: Requirements 3.5**
   */
  it('semanticSearch always returns matches sorted by score descending', async () => {
    await fc.assert(
      fc.asyncProperty(ragMatchArrayArb, async (sortedMatches) => {
        const client = makeMockPineconeClient(sortedMatches);
        const layer = new VectorRAGLayer(client);

        const result = await layer.semanticSearch('resume text');

        // Every consecutive pair must be non-increasing
        for (let i = 0; i < result.matches.length - 1; i++) {
          expect(result.matches[i]!.score).toBeGreaterThanOrEqual(
            result.matches[i + 1]!.score,
          );
        }
      }),
      { numRuns: 100 },
    );
  }, 30_000);

  /**
   * Property 3.2 — Ordering Preserved:
   *   calculateCosineSimilarity does not reorder or mutate the input matches
   *   array. The array passed in remains in the same order after the call.
   *
   * **Validates: Requirements 3.5**
   */
  it('calculateCosineSimilarity does not reorder or mutate the input matches array', () => {
    fc.assert(
      fc.property(ragMatchArrayArb, (matches) => {
        // Capture the original order by recording ids and scores
        const originalSnapshot = matches.map((m) => ({ id: m.id, score: m.score }));

        // Call the function — it must not mutate the array
        calculateCosineSimilarity(matches);

        // Verify the array is unchanged
        expect(matches).toHaveLength(originalSnapshot.length);
        for (let i = 0; i < matches.length; i++) {
          expect(matches[i]!.id).toBe(originalSnapshot[i]!.id);
          expect(matches[i]!.score).toBe(originalSnapshot[i]!.score);
        }
      }),
      { numRuns: 200 },
    );
  });

  /**
   * Property 3.3 — Score Bounds:
   *   calculateCosineSimilarity always returns a value in [0, 100] for any
   *   valid RAGMatch array (scores in [0, 1]).
   *
   * **Validates: Requirements 3.5**
   */
  it('calculateCosineSimilarity always returns a value in [0, 100]', () => {
    fc.assert(
      fc.property(ragMatchArrayArb, (matches) => {
        const result = calculateCosineSimilarity(matches);

        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(100);
      }),
      { numRuns: 200 },
    );
  });
});

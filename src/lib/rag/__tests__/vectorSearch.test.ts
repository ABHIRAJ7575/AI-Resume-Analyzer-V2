/**
 * Unit tests for VectorRAGLayer and calculateCosineSimilarity.
 * Requirements: 3.2, 3.5, 10.6, 12.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VectorRAGLayer, calculateCosineSimilarity } from '../vectorSearch';
import { RAGError } from '@/types/errors';
import type { RAGMatch } from '@/types';
import type { PineconeClient } from '../pineconeClient';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock the embeddingService module so tests don't hit the HF API
vi.mock('../embeddingService', () => ({
  generateEmbedding: vi.fn(),
}));

import { generateEmbedding } from '../embeddingService';

const mockGenerateEmbedding = vi.mocked(generateEmbedding);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FAKE_EMBEDDING = new Array<number>(384).fill(0.1);

/** Build a RAGMatch with the given score and optional id. */
function makeMatch(score: number, id = `match-${score}`): RAGMatch {
  return {
    id,
    score,
    metadata: { resumeType: 'template', industryTag: 'tech', qualityRating: 4 },
    text: `Resume text for ${id}`,
  };
}

/** Create a mock PineconeClient whose query() resolves to the given matches. */
function makeMockPineconeClient(matches: RAGMatch[]): PineconeClient {
  return {
    query: vi.fn().mockResolvedValue(matches),
    upsert: vi.fn(),
  } as unknown as PineconeClient;
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockGenerateEmbedding.mockResolvedValue(FAKE_EMBEDDING);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── calculateCosineSimilarity ────────────────────────────────────────────────

describe('calculateCosineSimilarity()', () => {
  it('returns 0 for empty matches array', () => {
    expect(calculateCosineSimilarity([])).toBe(0);
  });

  it('applies correct weights: 50% for rank-1, 30% for rank-2, 15% for rank-3, 5% for rank-4', () => {
    // All scores = 1.0 → each contributes weight * 1 * 100
    // weightedSum = 0.5*100 + 0.3*100 + 0.15*100 + 0.05*100 = 100
    // totalWeight = 1.0 → normalizedScore = 100
    const matches = [
      makeMatch(1.0, 'a'),
      makeMatch(1.0, 'b'),
      makeMatch(1.0, 'c'),
      makeMatch(1.0, 'd'),
    ];
    expect(calculateCosineSimilarity(matches)).toBe(100);
  });

  it('computes correct weighted score for known inputs', () => {
    // scores: [0.9, 0.8, 0.7, 0.6]
    // weightedSum = 0.9*0.5*100 + 0.8*0.3*100 + 0.7*0.15*100 + 0.6*0.05*100
    //            = 45 + 24 + 10.5 + 3 = 82.5
    // totalWeight = 1.0 → normalizedScore = 82.5
    const matches = [
      makeMatch(0.9, 'a'),
      makeMatch(0.8, 'b'),
      makeMatch(0.7, 'c'),
      makeMatch(0.6, 'd'),
    ];
    expect(calculateCosineSimilarity(matches)).toBeCloseTo(82.5, 5);
  });

  it('only uses top 4 matches even when more are provided', () => {
    // 5th match (score 0.99) should be ignored
    const matches = [
      makeMatch(0.9, 'a'),
      makeMatch(0.8, 'b'),
      makeMatch(0.7, 'c'),
      makeMatch(0.6, 'd'),
      makeMatch(0.99, 'e'), // beyond the 4-weight window
    ];
    // Same expected result as the 4-match test above
    expect(calculateCosineSimilarity(matches)).toBeCloseTo(82.5, 5);
  });

  it('handles a single match using only the first weight (0.5)', () => {
    // weightedSum = 0.8 * 0.5 * 100 = 40
    // totalWeight = 0.5 → normalizedScore = 40 / 0.5 = 80
    const matches = [makeMatch(0.8)];
    expect(calculateCosineSimilarity(matches)).toBeCloseTo(80, 5);
  });

  it('caps the result at 100', () => {
    // score > 1 is not expected from Pinecone but the cap must hold
    const matches = [makeMatch(1.5)];
    expect(calculateCosineSimilarity(matches)).toBe(100);
  });

  it('handles two matches with correct partial weights', () => {
    // weightedSum = 1.0*0.5*100 + 1.0*0.3*100 = 80
    // totalWeight = 0.8 → normalizedScore = 80 / 0.8 = 100
    const matches = [makeMatch(1.0, 'a'), makeMatch(1.0, 'b')];
    expect(calculateCosineSimilarity(matches)).toBeCloseTo(100, 5);
  });
});

// ─── VectorRAGLayer.semanticSearch() ─────────────────────────────────────────

describe('VectorRAGLayer.semanticSearch()', () => {
  it('returns matches sorted by score descending', async () => {
    const matches = [makeMatch(0.9), makeMatch(0.7), makeMatch(0.5)];
    const client = makeMockPineconeClient(matches);
    const layer = new VectorRAGLayer(client);

    const result = await layer.semanticSearch('some resume text');

    expect(result.matches).toHaveLength(3);
    expect(result.matches[0]!.score).toBeGreaterThanOrEqual(result.matches[1]!.score);
    expect(result.matches[1]!.score).toBeGreaterThanOrEqual(result.matches[2]!.score);
  });

  it('returns correct similarity score using the weighted formula', async () => {
    const matches = [makeMatch(0.9), makeMatch(0.8), makeMatch(0.7), makeMatch(0.6)];
    const client = makeMockPineconeClient(matches);
    const layer = new VectorRAGLayer(client);

    const result = await layer.semanticSearch('some resume text');

    // Same calculation as the unit test above: 82.5
    expect(result.similarity).toBeCloseTo(82.5, 5);
  });

  it('returns similarity = 0 when Pinecone returns no matches', async () => {
    const client = makeMockPineconeClient([]);
    const layer = new VectorRAGLayer(client);

    const result = await layer.semanticSearch('some resume text');

    expect(result.matches).toHaveLength(0);
    expect(result.similarity).toBe(0);
  });

  it('calls generateEmbedding with the provided text', async () => {
    const client = makeMockPineconeClient([]);
    const layer = new VectorRAGLayer(client);
    const text = 'Senior TypeScript engineer with 5 years experience';

    await layer.semanticSearch(text);

    expect(mockGenerateEmbedding).toHaveBeenCalledOnce();
    expect(mockGenerateEmbedding).toHaveBeenCalledWith(text);
  });

  it('calls pineconeClient.query with the embedding, "resumes" namespace, and topK', async () => {
    const client = makeMockPineconeClient([]);
    const queryMock = vi.mocked(client.query);
    const layer = new VectorRAGLayer(client);

    await layer.semanticSearch('resume text', 7);

    expect(queryMock).toHaveBeenCalledOnce();
    expect(queryMock).toHaveBeenCalledWith(FAKE_EMBEDDING, 'resumes', 7);
  });

  it('uses default topK = 5 when not specified', async () => {
    const client = makeMockPineconeClient([]);
    const queryMock = vi.mocked(client.query);
    const layer = new VectorRAGLayer(client);

    await layer.semanticSearch('resume text');

    expect(queryMock).toHaveBeenCalledWith(FAKE_EMBEDDING, 'resumes', 5);
  });

  it('propagates RAGError thrown by PineconeClient', async () => {
    const ragError = new RAGError('Pinecone query failed after all retries exhausted.');
    const client = {
      query: vi.fn().mockRejectedValue(ragError),
      upsert: vi.fn(),
    } as unknown as PineconeClient;
    const layer = new VectorRAGLayer(client);

    await expect(layer.semanticSearch('resume text')).rejects.toThrow(RAGError);
    await expect(layer.semanticSearch('resume text')).rejects.toThrow(
      /Pinecone query failed after all retries exhausted/,
    );
  });

  it('wraps unexpected errors from PineconeClient in a RAGError', async () => {
    const client = {
      query: vi.fn().mockRejectedValue(new TypeError('Unexpected network error')),
      upsert: vi.fn(),
    } as unknown as PineconeClient;
    const layer = new VectorRAGLayer(client);

    await expect(layer.semanticSearch('resume text')).rejects.toThrow(RAGError);
  });
});

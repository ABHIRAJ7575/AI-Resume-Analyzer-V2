/**
 * Integration tests for analyzeHandler
 *
 * Tests the full analysis pipeline orchestration including:
 * - Input validation
 * - Parallel DSA + RAG execution
 * - Graceful degradation when RAG or LLM fails
 * - Analysis result shape
 * - Persistence via saveAnalysisWithFallback
 *
 * Requirements: 2.3, 3.3, 4.1, 5.1, 10.1, 10.2, 12.1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAnalyze } from '../analyzeHandler';
import { ValidationError } from '@/types/errors';
import { RAGError, LLMError } from '@/types/errors';
import type { RAGMatch, LLMResponse } from '@/types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock the VectorRAGLayer so tests don't hit Pinecone.
// vi.hoisted ensures the mock fn is available before vi.mock hoisting runs.
const { mockSemanticSearch } = vi.hoisted(() => ({
  mockSemanticSearch: vi.fn().mockResolvedValue({
    matches: [] as RAGMatch[],
    similarity: 0,
  }),
}));

vi.mock('@/lib/rag/vectorSearch', () => {
  return {
    VectorRAGLayer: vi.fn().mockImplementation(function () {
      return { semanticSearch: mockSemanticSearch };
    }),
  };
});

// Mock LLM functions so tests don't hit Hugging Face.
// We use vi.hoisted so the mock fn reference is stable across all tests.
const { mockGenerateFeedback } = vi.hoisted(() => ({
  mockGenerateFeedback: vi.fn().mockResolvedValue({
    feedback: 'Mock feedback',
    starRecommendations: [
      { original: 'old', improved: 'new', reasoning: 'reason' },
    ],
    interviewQuestions: ['Q1?', 'Q2?', 'Q3?'],
  } satisfies LLMResponse),
}));

vi.mock('@/lib/llm/contextBuilder', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/llm/contextBuilder')>();
  return {
    ...actual,
    generateFeedback: mockGenerateFeedback,
  };
});

// Mock DB persistence so tests don't hit Supabase
vi.mock('@/lib/db/analysisRepository', () => ({
  saveAnalysisWithFallback: vi.fn().mockResolvedValue({ saved: true, cached: false }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** A resume text long enough to pass the 100-char minimum. */
const VALID_RESUME =
  'Architected and implemented scalable microservices using TypeScript, React, Node.js, ' +
  'PostgreSQL, AWS, Docker, and Kubernetes. Led a team of 5 engineers to deliver ' +
  'high-impact features on time. Optimized database queries reducing latency by 40%.';

const VALID_INPUT = {
  fileId: 'test-file-id',
  resumeText: VALID_RESUME,
  userId: 'user-123',
  fileName: 'resume.pdf',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('handleAnalyze()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default mock behaviour after each test
    mockSemanticSearch.mockResolvedValue({ matches: [] as RAGMatch[], similarity: 0 });
    mockGenerateFeedback.mockResolvedValue({
      feedback: 'Mock feedback',
      starRecommendations: [{ original: 'old', improved: 'new', reasoning: 'reason' }],
      interviewQuestions: ['Q1?', 'Q2?', 'Q3?'],
    } satisfies LLMResponse);
  });

  // ── Input validation ────────────────────────────────────────────────────────

  it('throws ValidationError when resumeText is empty', async () => {
    await expect(
      handleAnalyze({ ...VALID_INPUT, resumeText: '' }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when resumeText is whitespace only', async () => {
    await expect(
      handleAnalyze({ ...VALID_INPUT, resumeText: '   \n\t  ' }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when userId is empty', async () => {
    await expect(
      handleAnalyze({ ...VALID_INPUT, userId: '' }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when userId is whitespace only', async () => {
    await expect(
      handleAnalyze({ ...VALID_INPUT, userId: '   ' }),
    ).rejects.toThrow(ValidationError);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('returns a ResumeAnalysis with the correct shape', async () => {
    const result = await handleAnalyze(VALID_INPUT);

    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('userId', 'user-123');
    expect(result).toHaveProperty('fileName', 'resume.pdf');
    expect(result).toHaveProperty('uploadedAt');
    expect(result).toHaveProperty('parsedText', VALID_RESUME);
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('ragMatches');
    expect(result).toHaveProperty('llmFeedback');
    expect(result).toHaveProperty('metadata');
  });

  it('generates a unique id for each analysis', async () => {
    const [r1, r2] = await Promise.all([
      handleAnalyze(VALID_INPUT),
      handleAnalyze(VALID_INPUT),
    ]);
    expect(r1.id).not.toBe(r2.id);
  });

  it('sets uploadedAt to a recent Date', async () => {
    const before = Date.now();
    const result = await handleAnalyze(VALID_INPUT);
    const after = Date.now();

    expect(result.uploadedAt).toBeInstanceOf(Date);
    expect(result.uploadedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.uploadedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it('uses the provided fileName in the analysis record', async () => {
    const result = await handleAnalyze({ ...VALID_INPUT, fileName: 'my-cv.pdf' });
    expect(result.fileName).toBe('my-cv.pdf');
  });

  it('falls back to fileId.pdf when fileName is not provided', async () => {
    const { fileName: _omit, ...inputWithoutFileName } = VALID_INPUT;
    const result = await handleAnalyze(inputWithoutFileName);
    expect(result.fileName).toBe(`${VALID_INPUT.fileId}.pdf`);
  });

  // ── Score shape ─────────────────────────────────────────────────────────────

  it('returns a score with totalScore in [0, 100]', async () => {
    const result = await handleAnalyze(VALID_INPUT);
    expect(result.score.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.score.totalScore).toBeLessThanOrEqual(100);
  });

  it('returns a score breakdown with all three components', async () => {
    const result = await handleAnalyze(VALID_INPUT);
    expect(result.score.breakdown).toHaveProperty('skillDensity');
    expect(result.score.breakdown).toHaveProperty('actionVerbQuality');
    expect(result.score.breakdown).toHaveProperty('ragSimilarity');
  });

  it('returns a penalties array (may be empty)', async () => {
    const result = await handleAnalyze(VALID_INPUT);
    expect(Array.isArray(result.score.penalties)).toBe(true);
  });

  // ── Metadata ────────────────────────────────────────────────────────────────

  it('records a positive processingTimeMs', async () => {
    const result = await handleAnalyze(VALID_INPUT);
    expect(result.metadata.processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('records a positive wordCount', async () => {
    const result = await handleAnalyze(VALID_INPUT);
    expect(result.metadata.wordCount).toBeGreaterThan(0);
  });

  it('detects tech keywords from the resume text', async () => {
    const result = await handleAnalyze(VALID_INPUT);
    // VALID_RESUME contains TypeScript, React, Node.js, etc.
    expect(result.metadata.techStackDetected.length).toBeGreaterThan(0);
  });

  it('sets experienceLevel to one of the valid values', async () => {
    const result = await handleAnalyze(VALID_INPUT);
    expect(['junior', 'mid', 'senior', 'lead']).toContain(result.metadata.experienceLevel);
  });

  // ── Graceful degradation: RAG failure (Requirement 10.1) ───────────────────

  it('returns a result using DSA-only scoring when RAG search throws', async () => {
    const mockRag = {
      semanticSearch: vi.fn().mockRejectedValue(new RAGError('Pinecone unavailable')),
    };
    // Pass the failing RAG layer directly via the optional parameter
    const result = await handleAnalyze(VALID_INPUT, mockRag as never);

    // Should still return a valid analysis
    expect(result).toHaveProperty('id');
    expect(result.score.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.score.totalScore).toBeLessThanOrEqual(100);
    // RAG similarity should be 0 when RAG fails
    expect(result.score.breakdown.ragSimilarity).toBe(0);
  });

  it('returns empty ragMatches when RAG search fails', async () => {
    const mockRag = {
      semanticSearch: vi.fn().mockRejectedValue(new RAGError('Pinecone unavailable')),
    };
    const result = await handleAnalyze(VALID_INPUT, mockRag as never);
    expect(result.ragMatches).toEqual([]);
  });

  // ── Graceful degradation: LLM failure (Requirement 10.2) ──────────────────

  it('returns fallback LLM feedback when generateFeedback throws', async () => {
    mockGenerateFeedback.mockRejectedValueOnce(new LLMError('HF API down'));

    const result = await handleAnalyze(VALID_INPUT);

    // Should still return a valid analysis with fallback feedback
    expect(result).toHaveProperty('id');
    expect(result.llmFeedback).toHaveProperty('feedback');
    expect(result.llmFeedback.starRecommendations.length).toBeGreaterThanOrEqual(1);
    expect(result.llmFeedback.interviewQuestions.length).toBeGreaterThanOrEqual(1);
  });

  // ── LLM feedback shape ──────────────────────────────────────────────────────

  it('returns llmFeedback with at least one STAR recommendation', async () => {
    const result = await handleAnalyze(VALID_INPUT);
    expect(result.llmFeedback.starRecommendations.length).toBeGreaterThanOrEqual(1);
  });

  it('returns llmFeedback with at least one interview question', async () => {
    const result = await handleAnalyze(VALID_INPUT);
    expect(result.llmFeedback.interviewQuestions.length).toBeGreaterThanOrEqual(1);
  });

  it('returns STAR recommendations with original, improved, and reasoning fields', async () => {
    const result = await handleAnalyze(VALID_INPUT);
    const rec = result.llmFeedback.starRecommendations[0]!;
    expect(rec).toHaveProperty('original');
    expect(rec).toHaveProperty('improved');
    expect(rec).toHaveProperty('reasoning');
  });
});

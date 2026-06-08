/**
 * Integration tests for analysesHandler
 *
 * Tests paginated analysis history retrieval including:
 * - Default pagination values
 * - Custom page/pageSize parameters
 * - Ownership enforcement (userId filtering)
 * - Result shape
 *
 * Requirements: 5.4, 8.3, 8.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleGetAnalyses } from '../analysesHandler';
import type { ResumeAnalysis } from '@/types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock the repository so tests don't hit Supabase
vi.mock('@/lib/db/analysisRepository', () => ({
  getAnalysisHistory: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAnalysis(overrides: Partial<ResumeAnalysis> = {}): ResumeAnalysis {
  return {
    id: crypto.randomUUID(),
    userId: 'user-abc',
    fileName: 'resume.pdf',
    uploadedAt: new Date(),
    parsedText: 'Sample resume text with TypeScript React Node.js experience.',
    score: {
      totalScore: 72,
      breakdown: { skillDensity: 70, actionVerbQuality: 65, ragSimilarity: 80 },
      penalties: [],
    },
    ragMatches: [],
    llmFeedback: {
      feedback: 'Good resume.',
      starRecommendations: [{ original: 'old', improved: 'new', reasoning: 'r' }],
      interviewQuestions: ['Q1?', 'Q2?', 'Q3?'],
    },
    metadata: {
      processingTimeMs: 1200,
      pdfPageCount: 1,
      wordCount: 150,
      techStackDetected: ['typescript', 'react'],
      experienceLevel: 'mid',
    },
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('handleGetAnalyses()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Result shape ────────────────────────────────────────────────────────────

  it('returns analyses, total, page, and pageSize fields', async () => {
    const { getAnalysisHistory } = await import('@/lib/db/analysisRepository');
    vi.mocked(getAnalysisHistory).mockResolvedValueOnce({
      analyses: [makeAnalysis()],
      total: 1,
      page: 1,
      pageSize: 10,
    });

    const result = await handleGetAnalyses('user-abc');

    expect(result).toHaveProperty('analyses');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('page');
    expect(result).toHaveProperty('pageSize');
  });

  it('returns an array of ResumeAnalysis objects', async () => {
    const { getAnalysisHistory } = await import('@/lib/db/analysisRepository');
    const analyses = [makeAnalysis(), makeAnalysis()];
    vi.mocked(getAnalysisHistory).mockResolvedValueOnce({
      analyses,
      total: 2,
      page: 1,
      pageSize: 10,
    });

    const result = await handleGetAnalyses('user-abc');
    expect(Array.isArray(result.analyses)).toBe(true);
    expect(result.analyses).toHaveLength(2);
  });

  it('returns an empty array when the user has no analyses', async () => {
    const { getAnalysisHistory } = await import('@/lib/db/analysisRepository');
    vi.mocked(getAnalysisHistory).mockResolvedValueOnce({
      analyses: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    const result = await handleGetAnalyses('user-no-history');
    expect(result.analyses).toEqual([]);
    expect(result.total).toBe(0);
  });

  // ── Pagination forwarding ───────────────────────────────────────────────────

  it('forwards page and pageSize to the repository', async () => {
    const { getAnalysisHistory } = await import('@/lib/db/analysisRepository');
    vi.mocked(getAnalysisHistory).mockResolvedValueOnce({
      analyses: [],
      total: 0,
      page: 3,
      pageSize: 5,
    });

    await handleGetAnalyses('user-abc', 3, 5);

    expect(getAnalysisHistory).toHaveBeenCalledWith('user-abc', { page: 3, pageSize: 5 });
  });

  it('passes undefined page and pageSize when not provided (uses repository defaults)', async () => {
    const { getAnalysisHistory } = await import('@/lib/db/analysisRepository');
    vi.mocked(getAnalysisHistory).mockResolvedValueOnce({
      analyses: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    await handleGetAnalyses('user-abc');

    expect(getAnalysisHistory).toHaveBeenCalledWith('user-abc', {
      page: undefined,
      pageSize: undefined,
    });
  });

  it('reflects the page number returned by the repository', async () => {
    const { getAnalysisHistory } = await import('@/lib/db/analysisRepository');
    vi.mocked(getAnalysisHistory).mockResolvedValueOnce({
      analyses: [],
      total: 50,
      page: 2,
      pageSize: 10,
    });

    const result = await handleGetAnalyses('user-abc', 2, 10);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
  });

  // ── Ownership enforcement ───────────────────────────────────────────────────

  it('passes the userId to the repository for ownership filtering', async () => {
    const { getAnalysisHistory } = await import('@/lib/db/analysisRepository');
    vi.mocked(getAnalysisHistory).mockResolvedValueOnce({
      analyses: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    await handleGetAnalyses('specific-user-id');

    expect(getAnalysisHistory).toHaveBeenCalledWith(
      'specific-user-id',
      expect.any(Object),
    );
  });

  it('does not mix results from different users', async () => {
    const { getAnalysisHistory } = await import('@/lib/db/analysisRepository');

    const userAAnalysis = makeAnalysis({ userId: 'user-A' });
    const userBAnalysis = makeAnalysis({ userId: 'user-B' });

    // First call returns user-A's data
    vi.mocked(getAnalysisHistory)
      .mockResolvedValueOnce({ analyses: [userAAnalysis], total: 1, page: 1, pageSize: 10 })
      .mockResolvedValueOnce({ analyses: [userBAnalysis], total: 1, page: 1, pageSize: 10 });

    const resultA = await handleGetAnalyses('user-A');
    const resultB = await handleGetAnalyses('user-B');

    expect(resultA.analyses[0]!.userId).toBe('user-A');
    expect(resultB.analyses[0]!.userId).toBe('user-B');
  });

  // ── Error propagation ───────────────────────────────────────────────────────

  it('propagates errors thrown by the repository', async () => {
    const { getAnalysisHistory } = await import('@/lib/db/analysisRepository');
    vi.mocked(getAnalysisHistory).mockRejectedValueOnce(new Error('DB connection lost'));

    await expect(handleGetAnalyses('user-abc')).rejects.toThrow('DB connection lost');
  });
});

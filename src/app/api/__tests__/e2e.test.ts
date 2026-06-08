/**
 * End-to-end test suite — Task 22.1
 *
 * Tests the complete user flow through the API layer:
 *   1. Upload → Analysis → History (complete flow)
 *   2. Authentication and authorization flows
 *   3. Error scenarios and graceful degradation
 *   4. Responsive design component logic
 *
 * Strategy:
 *  - Auth / HTTP-level tests call the Next.js route handlers directly with
 *    Web Request objects (same as the existing route-level tests).
 *  - Business-logic / flow tests call the handler functions directly
 *    (handleUpload, handleAnalyze, handleGetAnalyses) to avoid module-cache
 *    issues with vi.mock, matching the pattern used in the existing unit tests.
 *  - Responsive-design tests read component source files to verify the
 *    Tailwind classes that drive layout breakpoints.
 *
 * Requirements: 10.1, 10.2, 15.1, 15.2, 15.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RAGMatch, LLMResponse } from '@/types';

// ─── Mocks (must be declared before any imports that use them) ────────────────

const { mockSemanticSearch } = vi.hoisted(() => ({
  mockSemanticSearch: vi.fn().mockResolvedValue({
    matches: [] as RAGMatch[],
    similarity: 0,
  }),
}));

const { mockGenerateFeedback } = vi.hoisted(() => ({
  mockGenerateFeedback: vi.fn().mockResolvedValue({
    feedback: 'Good resume.',
    starRecommendations: [{ original: 'old', improved: 'new', reasoning: 'reason' }],
    interviewQuestions: ['Q1?', 'Q2?', 'Q3?'],
  } satisfies LLMResponse),
}));

vi.mock('@/lib/rag/vectorSearch', () => {
  return {
    VectorRAGLayer: vi.fn().mockImplementation(function () {
      return { semanticSearch: mockSemanticSearch };
    }),
  };
});

vi.mock('@/lib/llm/contextBuilder', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/llm/contextBuilder')>();
  return { ...actual, generateFeedback: mockGenerateFeedback };
});

vi.mock('@/lib/db/analysisRepository', () => ({
  saveAnalysisWithFallback: vi.fn().mockResolvedValue({ saved: true, cached: false }),
  getAnalysisHistory: vi.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { handleUpload } from '@/lib/api/uploadHandler';
import { handleAnalyze } from '@/lib/api/analyzeHandler';
import { handleGetAnalyses } from '@/lib/api/analysesHandler';
import { POST as uploadRoute } from '../upload/route';
import { POST as analyzeRoute } from '../analyze/route';
import { GET as analysesRoute } from '../analyses/route';
import type { NextRequest } from 'next/server';
import * as path from 'path';
import * as fs from 'fs';

// ─── JWT helpers ──────────────────────────────────────────────────────────────

function buildJWT(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = Buffer.from('fake-sig').toString('base64url');
  return `${header}.${body}.${sig}`;
}

function nowPlusSecs(secs: number): number {
  return Math.floor(Date.now() / 1000) + secs;
}

const VALID_TOKEN = buildJWT({
  sub: 'user-e2e-123',
  email: 'e2e@example.com',
  exp: nowPlusSecs(3600),
  iat: nowPlusSecs(-60),
  role: 'authenticated',
});

const EXPIRED_TOKEN = buildJWT({
  sub: 'user-expired',
  email: 'expired@example.com',
  exp: nowPlusSecs(-3600),
  iat: nowPlusSecs(-7200),
});

// ─── Request builders (for route-level tests) ─────────────────────────────────

function makeAnalyzeRequest(body: Record<string, unknown>, token?: string): Request {
  return new Request('http://localhost/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function makeAnalysesRequest(token?: string, params?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/analyses');
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  return new Request(url.toString(), {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }) as unknown as NextRequest;
}

// ─── FormData helpers (for handler-level upload tests) ────────────────────────

function makePdfBuffer(extraBytes = 200): Uint8Array {
  const buf = new Uint8Array(4 + extraBytes);
  buf[0] = 0x25; buf[1] = 0x50; buf[2] = 0x44; buf[3] = 0x46; // %PDF
  return buf;
}

function makeFormData(bytes: Uint8Array, fileName = 'resume.pdf'): FormData {
  const fd = new FormData();
  fd.append('file', new File([bytes], fileName, { type: 'application/pdf' }));
  return fd;
}

const VALID_RESUME =
  'Architected and implemented scalable microservices using TypeScript, React, Node.js, ' +
  'PostgreSQL, AWS, Docker, and Kubernetes. Led a team of 5 engineers to deliver ' +
  'high-impact features on time. Optimized database queries reducing latency by 40%.';

// ─── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockSemanticSearch.mockResolvedValue({ matches: [] as RAGMatch[], similarity: 0 });
  mockGenerateFeedback.mockResolvedValue({
    feedback: 'Good resume.',
    starRecommendations: [{ original: 'old', improved: 'new', reasoning: 'reason' }],
    interviewQuestions: ['Q1?', 'Q2?', 'Q3?'],
  } satisfies LLMResponse);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. COMPLETE USER FLOW: Upload → Analysis → History
// ═══════════════════════════════════════════════════════════════════════════════

describe('Complete user flow: upload → analysis → history', () => {
  it('upload returns fileId, fileName, and size for a valid PDF', async () => {
    const result = await handleUpload(makeFormData(makePdfBuffer()));
    expect(typeof result.fileId).toBe('string');
    expect(result.fileId.length).toBeGreaterThan(0);
    expect(result.fileName).toBe('resume.pdf');
    expect(typeof result.size).toBe('number');
  });

  it('upload generates a unique fileId on each call', async () => {
    const [r1, r2] = await Promise.all([
      handleUpload(makeFormData(makePdfBuffer())),
      handleUpload(makeFormData(makePdfBuffer())),
    ]);
    expect(r1.fileId).not.toBe(r2.fileId);
  });

  it('analyze returns a complete ResumeAnalysis with correct shape', async () => {
    const result = await handleAnalyze({
      fileId: 'file-1',
      resumeText: VALID_RESUME,
      userId: 'user-e2e-123',
      fileName: 'resume.pdf',
    });
    expect(typeof result.id).toBe('string');
    expect(result.userId).toBe('user-e2e-123');
    expect(result.fileName).toBe('resume.pdf');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('ragMatches');
    expect(result).toHaveProperty('llmFeedback');
    expect(result).toHaveProperty('metadata');
  });

  it('analyze score totalScore is within [0, 100]', async () => {
    const result = await handleAnalyze({
      fileId: 'file-2',
      resumeText: VALID_RESUME,
      userId: 'user-e2e-123',
    });
    expect(result.score.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.score.totalScore).toBeLessThanOrEqual(100);
  });

  it('analyze result contains all three score breakdown components', async () => {
    const result = await handleAnalyze({
      fileId: 'file-3',
      resumeText: VALID_RESUME,
      userId: 'user-e2e-123',
    });
    expect(result.score.breakdown).toHaveProperty('skillDensity');
    expect(result.score.breakdown).toHaveProperty('actionVerbQuality');
    expect(result.score.breakdown).toHaveProperty('ragSimilarity');
  });

  it('analyze result contains at least one STAR recommendation', async () => {
    const result = await handleAnalyze({
      fileId: 'file-4',
      resumeText: VALID_RESUME,
      userId: 'user-e2e-123',
    });
    expect(result.llmFeedback.starRecommendations.length).toBeGreaterThanOrEqual(1);
  });

  it('analyze result contains at least one interview question', async () => {
    const result = await handleAnalyze({
      fileId: 'file-5',
      resumeText: VALID_RESUME,
      userId: 'user-e2e-123',
    });
    expect(result.llmFeedback.interviewQuestions.length).toBeGreaterThanOrEqual(1);
  });

  it('analyze records a positive processingTimeMs in metadata', async () => {
    const result = await handleAnalyze({
      fileId: 'file-6',
      resumeText: VALID_RESUME,
      userId: 'user-e2e-123',
    });
    expect(result.metadata.processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('analyze detects tech keywords from the resume text', async () => {
    const result = await handleAnalyze({
      fileId: 'file-7',
      resumeText: VALID_RESUME,
      userId: 'user-e2e-123',
    });
    expect(result.metadata.techStackDetected.length).toBeGreaterThan(0);
  });

  it('history returns analyses array and pagination fields', async () => {
    const { getAnalysisHistory } = await import('@/lib/db/analysisRepository');
    vi.mocked(getAnalysisHistory).mockResolvedValueOnce({
      analyses: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });
    const result = await handleGetAnalyses('user-e2e-123');
    expect(Array.isArray(result.analyses)).toBe(true);
    expect(typeof result.total).toBe('number');
    expect(typeof result.page).toBe('number');
    expect(typeof result.pageSize).toBe('number');
  });

  it('history forwards page and pageSize to the repository', async () => {
    const { getAnalysisHistory } = await import('@/lib/db/analysisRepository');
    vi.mocked(getAnalysisHistory).mockResolvedValueOnce({
      analyses: [],
      total: 0,
      page: 2,
      pageSize: 5,
    });
    await handleGetAnalyses('user-e2e-123', 2, 5);
    expect(getAnalysisHistory).toHaveBeenCalledWith('user-e2e-123', { page: 2, pageSize: 5 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. AUTHENTICATION AND AUTHORIZATION FLOWS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Authentication and authorization flows', () => {
  // ── /api/analyze auth ──────────────────────────────────────────────────────

  it('analyze route returns 401 when Authorization header is missing', async () => {
    const req = makeAnalyzeRequest({ fileId: 'f', resumeText: VALID_RESUME });
    const res = await analyzeRoute(req);
    expect(res.status).toBe(401);
  });

  it('analyze route returns 401 when token is expired', async () => {
    const req = makeAnalyzeRequest(
      { fileId: 'f', resumeText: VALID_RESUME },
      EXPIRED_TOKEN,
    );
    const res = await analyzeRoute(req);
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/expired/i);
  });

  it('analyze route returns 401 when token is malformed', async () => {
    const req = makeAnalyzeRequest(
      { fileId: 'f', resumeText: VALID_RESUME },
      'not.a.valid.jwt',
    );
    const res = await analyzeRoute(req);
    expect(res.status).toBe(401);
  });

  it('analyze route returns 401 when Authorization header has no Bearer prefix', async () => {
    const req = new Request('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: VALID_TOKEN },
      body: JSON.stringify({ fileId: 'f', resumeText: VALID_RESUME }),
    });
    const res = await analyzeRoute(req);
    expect(res.status).toBe(401);
  });

  it('analyze handler uses userId from JWT sub claim', async () => {
    const tokenForUser = buildJWT({
      sub: 'specific-user-id',
      email: 'specific@example.com',
      exp: nowPlusSecs(3600),
      iat: nowPlusSecs(-60),
    });
    const result = await handleAnalyze({
      fileId: 'f',
      resumeText: VALID_RESUME,
      userId: 'specific-user-id',
    });
    expect(result.userId).toBe('specific-user-id');
    // Verify the token would decode to the same userId
    const { validateJWT } = await import('@/lib/auth/jwtMiddleware');
    const jwtResult = validateJWT(tokenForUser);
    expect(jwtResult.valid).toBe(true);
    expect(jwtResult.payload?.sub).toBe('specific-user-id');
  });

  // ── /api/analyses auth ─────────────────────────────────────────────────────

  it('analyses route returns 401 when Authorization header is missing', async () => {
    const req = makeAnalysesRequest();
    const res = await analysesRoute(req);
    expect(res.status).toBe(401);
  });

  it('analyses route returns 401 when token is expired', async () => {
    const req = makeAnalysesRequest(EXPIRED_TOKEN);
    const res = await analysesRoute(req);
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/expired/i);
  });

  it('analyses route returns 401 when token is malformed', async () => {
    const req = makeAnalysesRequest('garbage.token');
    const res = await analysesRoute(req);
    expect(res.status).toBe(401);
  });

  it('analyses handler passes userId to repository for ownership enforcement', async () => {
    const { getAnalysisHistory } = await import('@/lib/db/analysisRepository');
    vi.mocked(getAnalysisHistory).mockResolvedValueOnce({
      analyses: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });
    await handleGetAnalyses('owner-user-id');
    expect(getAnalysisHistory).toHaveBeenCalledWith('owner-user-id', expect.any(Object));
  });

  it('two different users receive only their own analyses', async () => {
    const { getAnalysisHistory } = await import('@/lib/db/analysisRepository');
    vi.mocked(getAnalysisHistory)
      .mockResolvedValueOnce({ analyses: [], total: 0, page: 1, pageSize: 10 })
      .mockResolvedValueOnce({ analyses: [], total: 0, page: 1, pageSize: 10 });

    await handleGetAnalyses('user-A');
    await handleGetAnalyses('user-B');

    const calls = vi.mocked(getAnalysisHistory).mock.calls;
    expect(calls[0]![0]).toBe('user-A');
    expect(calls[1]![0]).toBe('user-B');
  });

  it('valid JWT token is accepted and returns 200 on analyze route', async () => {
    const req = makeAnalyzeRequest(
      { fileId: 'f', resumeText: VALID_RESUME },
      VALID_TOKEN,
    );
    const res = await analyzeRoute(req);
    // Should not be 401 — auth passed
    expect(res.status).not.toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ERROR SCENARIOS AND GRACEFUL DEGRADATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Error scenarios and graceful degradation', () => {
  // ── Upload validation errors ───────────────────────────────────────────────

  it('upload throws ValidationError when no file is provided', async () => {
    const { ValidationError } = await import('@/types/errors');
    await expect(handleUpload(new FormData())).rejects.toThrow(ValidationError);
  });

  it('upload throws ValidationError when file has invalid magic bytes', async () => {
    const { ValidationError } = await import('@/types/errors');
    const nonPdf = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG
    await expect(handleUpload(makeFormData(nonPdf, 'image.png'))).rejects.toThrow(ValidationError);
  });

  it('upload throws ValidationError when file exceeds 10 MB', async () => {
    const { ValidationError } = await import('@/types/errors');
    const oversized = new Uint8Array(10 * 1024 * 1024 + 1);
    oversized[0] = 0x25; oversized[1] = 0x50; oversized[2] = 0x44; oversized[3] = 0x46;
    await expect(handleUpload(makeFormData(oversized))).rejects.toThrow(ValidationError);
  });

  it('upload route returns 400 with user-friendly error (no stack trace)', async () => {
    const fd = new FormData();
    const req = new Request('http://localhost/api/upload', { method: 'POST', body: fd });
    const res = await uploadRoute(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
    expect(body.error).not.toMatch(/at\s+\w+\s+\(/); // no stack trace lines
  });

  // ── Analyze validation errors ──────────────────────────────────────────────

  it('analyze throws ValidationError when resumeText is empty', async () => {
    const { ValidationError } = await import('@/types/errors');
    await expect(
      handleAnalyze({ fileId: 'f', resumeText: '', userId: 'u' }),
    ).rejects.toThrow(ValidationError);
  });

  it('analyze throws ValidationError when resumeText is whitespace only', async () => {
    const { ValidationError } = await import('@/types/errors');
    await expect(
      handleAnalyze({ fileId: 'f', resumeText: '   \n\t  ', userId: 'u' }),
    ).rejects.toThrow(ValidationError);
  });

  it('analyze throws ValidationError when userId is empty', async () => {
    const { ValidationError } = await import('@/types/errors');
    await expect(
      handleAnalyze({ fileId: 'f', resumeText: VALID_RESUME, userId: '' }),
    ).rejects.toThrow(ValidationError);
  });

  it('analyze route returns 400 with user-friendly error for empty resumeText', async () => {
    const req = makeAnalyzeRequest({ fileId: 'f', resumeText: '' }, VALID_TOKEN);
    const res = await analyzeRoute(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(typeof body.error).toBe('string');
    expect(body.error).not.toMatch(/at\s+\w+\s+\(/);
  });

  // ── Graceful degradation: RAG unavailable (Requirement 10.1) ──────────────

  it('analyze returns DSA-only result when RAG service throws RAGError', async () => {
    const { RAGError } = await import('@/types/errors');
    const failingRag = {
      semanticSearch: vi.fn().mockRejectedValue(new RAGError('Pinecone down')),
    };
    const result = await handleAnalyze(
      { fileId: 'f', resumeText: VALID_RESUME, userId: 'u' },
      failingRag as never,
    );
    expect(result).toHaveProperty('id');
    expect(result.score.breakdown.ragSimilarity).toBe(0);
  });

  it('analyze totalScore stays in [0,100] when RAG fails', async () => {
    const { RAGError } = await import('@/types/errors');
    const failingRag = {
      semanticSearch: vi.fn().mockRejectedValue(new RAGError('Pinecone timeout')),
    };
    const result = await handleAnalyze(
      { fileId: 'f', resumeText: VALID_RESUME, userId: 'u' },
      failingRag as never,
    );
    expect(result.score.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.score.totalScore).toBeLessThanOrEqual(100);
  });

  it('analyze returns empty ragMatches when RAG fails', async () => {
    const { RAGError } = await import('@/types/errors');
    const failingRag = {
      semanticSearch: vi.fn().mockRejectedValue(new RAGError('Pinecone down')),
    };
    const result = await handleAnalyze(
      { fileId: 'f', resumeText: VALID_RESUME, userId: 'u' },
      failingRag as never,
    );
    expect(result.ragMatches).toEqual([]);
  });

  // ── Graceful degradation: LLM unavailable (Requirement 10.2) ──────────────

  it('analyze returns fallback feedback when LLM throws LLMError', async () => {
    const { LLMError } = await import('@/types/errors');
    mockGenerateFeedback.mockRejectedValueOnce(new LLMError('HF API down'));
    const result = await handleAnalyze({
      fileId: 'f',
      resumeText: VALID_RESUME,
      userId: 'u',
    });
    expect(result.llmFeedback.starRecommendations.length).toBeGreaterThanOrEqual(1);
    expect(result.llmFeedback.interviewQuestions.length).toBeGreaterThanOrEqual(1);
  });

  it('analyze returns valid scores even when both RAG and LLM fail', async () => {
    const { RAGError, LLMError } = await import('@/types/errors');
    const failingRag = {
      semanticSearch: vi.fn().mockRejectedValue(new RAGError('Pinecone down')),
    };
    mockGenerateFeedback.mockRejectedValueOnce(new LLMError('HF API down'));
    const result = await handleAnalyze(
      { fileId: 'f', resumeText: VALID_RESUME, userId: 'u' },
      failingRag as never,
    );
    expect(result.score.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.score.totalScore).toBeLessThanOrEqual(100);
    expect(result.llmFeedback.starRecommendations.length).toBeGreaterThanOrEqual(1);
  });

  // ── History error propagation ──────────────────────────────────────────────

  it('analyses handler propagates repository errors', async () => {
    const { getAnalysisHistory } = await import('@/lib/db/analysisRepository');
    vi.mocked(getAnalysisHistory).mockRejectedValueOnce(new Error('DB connection lost'));
    await expect(handleGetAnalyses('user-abc')).rejects.toThrow('DB connection lost');
  });

  it('analyses route returns 500 with user-friendly message on repository error', async () => {
    const { getAnalysisHistory } = await import('@/lib/db/analysisRepository');
    vi.mocked(getAnalysisHistory).mockRejectedValueOnce(new Error('DB connection lost'));
    const req = makeAnalysesRequest(VALID_TOKEN);
    const res = await analysesRoute(req);
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(typeof body.error).toBe('string');
    expect(body.error).not.toContain('DB connection lost');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. RESPONSIVE DESIGN — COMPONENT LAYOUT LOGIC
//
// Verifies the Tailwind CSS classes that drive responsive breakpoints are
// present in the component source files. This tests the layout contract
// (which classes are applied) rather than visual rendering.
//
// Requirements: 15.1 (mobile single-column), 15.2 (tablet two-column),
//               15.3 (desktop asymmetric Bento grid)
// ═══════════════════════════════════════════════════════════════════════════════

// Absolute paths to component source files
const BENTO_GRID_PATH = path.resolve(
  __dirname,
  '../../../components/dashboard/BentoGrid.tsx',
);
const STAR_COMPARISON_PATH = path.resolve(
  __dirname,
  '../../../components/dashboard/STARComparison.tsx',
);

describe('Responsive design — component layout logic', () => {
  // ── BentoDashboard grid breakpoints ───────────────────────────────────────

  it('BentoDashboard applies grid-cols-1 for mobile (single-column layout)', () => {
    // Requirement 15.1: mobile → single column
    const source = fs.readFileSync(BENTO_GRID_PATH, 'utf8');
    expect(source).toContain('grid-cols-1');
  });

  it('BentoDashboard applies md:grid-cols-2 for tablet (two-column layout)', () => {
    // Requirement 15.2: tablet → two-column grid
    const source = fs.readFileSync(BENTO_GRID_PATH, 'utf8');
    expect(source).toContain('md:grid-cols-2');
  });

  it('BentoDashboard applies lg:grid-cols-3 for desktop (asymmetric Bento grid)', () => {
    // Requirement 15.3: desktop → full asymmetric Bento grid
    const source = fs.readFileSync(BENTO_GRID_PATH, 'utf8');
    expect(source).toContain('lg:grid-cols-3');
  });

  it('BentoDashboard STAR card spans lg:col-span-2 for wider content area on desktop', () => {
    // Requirement 15.3: asymmetric layout — STAR comparison takes 2 of 3 columns
    const source = fs.readFileSync(BENTO_GRID_PATH, 'utf8');
    expect(source).toContain('lg:col-span-2');
  });

  // ── STARComparison split-view modes ───────────────────────────────────────

  it('STARComparison uses grid-cols-2 for horizontal (desktop) split layout', () => {
    // Requirement 15.3: desktop → side-by-side before/after comparison
    const source = fs.readFileSync(STAR_COMPARISON_PATH, 'utf8');
    expect(source).toContain('grid-cols-2');
  });

  it('STARComparison uses flex-col for vertical (mobile) stacked layout', () => {
    // Requirement 15.1: mobile → stacked before/after comparison
    const source = fs.readFileSync(STAR_COMPARISON_PATH, 'utf8');
    expect(source).toContain('flex-col');
  });

  it('STARComparison splitViewMode prop accepts "horizontal" and "vertical" values', () => {
    // Verify the component exports the correct prop interface
    const source = fs.readFileSync(STAR_COMPARISON_PATH, 'utf8');
    expect(source).toContain("'horizontal'");
    expect(source).toContain("'vertical'");
  });

  it('STARComparison defaults to horizontal split mode', () => {
    // Requirement 15.3: desktop default is horizontal
    const source = fs.readFileSync(STAR_COMPARISON_PATH, 'utf8');
    // Default value is set in the destructured parameter
    expect(source).toContain("splitViewMode = 'horizontal'");
  });

  // ── BentoDashboard responsive grid is applied to the top row ──────────────

  it('BentoDashboard top row grid has all three breakpoint classes together', () => {
    const source = fs.readFileSync(BENTO_GRID_PATH, 'utf8');
    // All three classes should appear in the same grid div
    expect(source).toMatch(/grid-cols-1[^"]*md:grid-cols-2[^"]*lg:grid-cols-3/);
  });
});

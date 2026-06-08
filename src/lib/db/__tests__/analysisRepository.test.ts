/**
 * Integration tests for analysisRepository functions.
 * Requirements: 5.1, 5.4, 5.5, 5.6, 11.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'crypto';
import { DatabaseError } from '@/types/errors';
import type { ResumeAnalysis } from '@/types';

// ─── Set up encryption key before any imports that trigger encryption ─────────

// Use a fixed test key so encrypted values are deterministic within a test run.
const TEST_ENCRYPTION_KEY = randomBytes(32).toString('hex');
process.env['RESUME_ENCRYPTION_KEY'] = TEST_ENCRYPTION_KEY;

// ─── Mock supabaseClient module ───────────────────────────────────────────────

// We mock the entire supabaseClient module so no real HTTP calls are made.
vi.mock('../supabaseClient', () => {
  // A chainable query builder mock factory
  const makeQueryBuilder = () => {
    const qb = {
      _insertData: null as unknown,
      _filters: [] as string[],
      _rangeFrom: null as number | null,
      _rangeTo: null as number | null,
      _executeResult: { data: null as unknown[] | null, error: null as Error | null },

      insert: vi.fn().mockImplementation(function (this: typeof qb, data: unknown) {
        this._insertData = data;
        return this;
      }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(function (this: typeof qb, col: string, val: unknown) {
        this._filters.push(`${col}=${String(val)}`);
        return this;
      }),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockImplementation(function (this: typeof qb, from: number, to: number) {
        this._rangeFrom = from;
        this._rangeTo = to;
        return this;
      }),
      execute: vi.fn().mockImplementation(async function (this: typeof qb) {
        return this._executeResult;
      }),
    };
    return qb;
  };

  // The mock SupabaseClient class
  const MockSupabaseClient = vi.fn().mockImplementation(() => ({
    from: vi.fn().mockImplementation(() => makeQueryBuilder()),
  }));

  return {
    SupabaseClient: MockSupabaseClient,
    createSupabaseClient: vi.fn().mockImplementation(() => new MockSupabaseClient()),
  };
});

// Import AFTER the mock is set up
import {
  saveAnalysis,
  saveAnalysisWithFallback,
  getAnalysisHistory,
  getAnalysisById,
  AnalysisRepository,
} from '../analysisRepository';
import { createSupabaseClient as _createSupabaseClient, SupabaseClient } from '../supabaseClient';
import { encryptText, looksEncrypted } from '@/lib/security/encryption';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeAnalysis(overrides: Partial<ResumeAnalysis> = {}): ResumeAnalysis {
  return {
    id: 'analysis-uuid-1',
    userId: 'user-123',
    fileName: 'resume.pdf',
    uploadedAt: new Date('2024-01-15T10:00:00Z'),
    parsedText: 'Senior TypeScript engineer with 5 years experience.',
    score: {
      totalScore: 75,
      breakdown: { skillDensity: 70, actionVerbQuality: 80, ragSimilarity: 75 },
      penalties: [],
    },
    ragMatches: [
      {
        id: 'match-1',
        score: 0.9,
        metadata: { resumeType: 'template', industryTag: 'tech', qualityRating: 5 },
        text: 'Example resume text',
      },
    ],
    llmFeedback: {
      feedback: 'Great resume!',
      starRecommendations: [
        { original: 'Worked on backend', improved: 'Architected backend', reasoning: 'Action verb' },
      ],
      interviewQuestions: ['Tell me about yourself.', 'What is your greatest strength?', 'Where do you see yourself in 5 years?'],
    },
    metadata: {
      processingTimeMs: 1200,
      pdfPageCount: 2,
      wordCount: 450,
      techStackDetected: ['TypeScript', 'React'],
      experienceLevel: 'senior',
    },
    ...overrides,
  };
}

/** Build a DB row shape (snake_case) matching the analysis fixture.
 *  parsed_text is stored encrypted, as it would be in the real database.
 */
function makeRow(analysis: ResumeAnalysis) {
  const key = Buffer.from(TEST_ENCRYPTION_KEY, 'hex');
  return {
    id: analysis.id,
    user_id: analysis.userId,
    file_name: analysis.fileName,
    uploaded_at: analysis.uploadedAt.toISOString(),
    parsed_text: encryptText(analysis.parsedText, key),
    score: analysis.score,
    rag_matches: analysis.ragMatches,
    llm_feedback: analysis.llmFeedback,
    metadata: analysis.metadata,
  };
}

// ─── Helper: build a mock SupabaseClient with controlled execute results ───────

function makeMockClient(executeResult: { data: unknown[] | null; error: Error | null }) {
  const qb = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(executeResult),
  };

  const client = {
    from: vi.fn().mockReturnValue(qb),
    _qb: qb,
  } as unknown as SupabaseClient & { _qb: typeof qb };

  return client;
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Stub setTimeout so retry delays don't slow tests
  vi.stubGlobal('setTimeout', (fn: () => void) => { fn(); return 0 as unknown as ReturnType<typeof setTimeout>; });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── saveAnalysis ─────────────────────────────────────────────────────────────

describe('saveAnalysis()', () => {
  it('calls insert with correctly mapped snake_case data', async () => {
    const analysis = makeAnalysis();
    const client = makeMockClient({ data: [makeRow(analysis)], error: null });

    await saveAnalysis(analysis, client as unknown as SupabaseClient);

    expect(client.from).toHaveBeenCalledWith('analyses');
    const qb = client._qb;
    expect(qb.insert).toHaveBeenCalledOnce();

    const insertArg = qb.insert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArg['id']).toBe(analysis.id);
    expect(insertArg['user_id']).toBe(analysis.userId);
    expect(insertArg['file_name']).toBe(analysis.fileName);
    // parsed_text must be encrypted at rest (not the original plaintext)
    expect(insertArg['parsed_text']).not.toBe(analysis.parsedText);
    expect(looksEncrypted(insertArg['parsed_text'] as string)).toBe(true);
    expect(insertArg['uploaded_at']).toBe(analysis.uploadedAt.toISOString());
    expect(insertArg['score']).toEqual(analysis.score);
    expect(insertArg['rag_matches']).toEqual(analysis.ragMatches);
    expect(insertArg['llm_feedback']).toEqual(analysis.llmFeedback);
    expect(insertArg['metadata']).toEqual(analysis.metadata);
  });

  it('retries on failure up to 3 times', async () => {
    const analysis = makeAnalysis();
    const dbError = new Error('Connection timeout');

    // All 3 attempts fail
    const qb = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({ data: null, error: dbError }),
    };
    const client = { from: vi.fn().mockReturnValue(qb) } as unknown as SupabaseClient;

    await expect(saveAnalysis(analysis, client)).rejects.toThrow(DatabaseError);
    // execute() should be called 3 times (MAX_RETRIES)
    expect(qb.execute).toHaveBeenCalledTimes(3);
  });

  it('throws DatabaseError after all retries are exhausted', async () => {
    const analysis = makeAnalysis();
    const dbError = new Error('DB unavailable');

    const qb = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({ data: null, error: dbError }),
    };
    const client = { from: vi.fn().mockReturnValue(qb) } as unknown as SupabaseClient;

    await expect(saveAnalysis(analysis, client)).rejects.toThrow(DatabaseError);
    await expect(saveAnalysis(analysis, client)).rejects.toThrow(/Failed to save analysis after 3 attempts/);
  });

  it('succeeds on the second attempt (retry logic)', async () => {
    const analysis = makeAnalysis();
    const dbError = new Error('Transient error');

    const qb = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      execute: vi.fn()
        .mockResolvedValueOnce({ data: null, error: dbError })
        .mockResolvedValueOnce({ data: [makeRow(analysis)], error: null }),
    };
    const client = { from: vi.fn().mockReturnValue(qb) } as unknown as SupabaseClient;

    await expect(saveAnalysis(analysis, client)).resolves.toBeUndefined();
    expect(qb.execute).toHaveBeenCalledTimes(2);
  });
});

// ─── saveAnalysisWithFallback ─────────────────────────────────────────────────

describe('saveAnalysisWithFallback()', () => {
  it('returns { saved: true, cached: false } on success', async () => {
    const analysis = makeAnalysis();
    const client = makeMockClient({ data: [makeRow(analysis)], error: null });

    const result = await saveAnalysisWithFallback(analysis, client as unknown as SupabaseClient);

    expect(result).toEqual({ saved: true, cached: false });
  });

  it('returns { saved: false, cached: true } on DB failure', async () => {
    const analysis = makeAnalysis({ id: 'fallback-id-1' });
    const dbError = new Error('DB down');

    const qb = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({ data: null, error: dbError }),
    };
    const client = { from: vi.fn().mockReturnValue(qb) } as unknown as SupabaseClient;

    const result = await saveAnalysisWithFallback(analysis, client);

    expect(result).toEqual({ saved: false, cached: true });
  });
});

// ─── getAnalysisHistory ───────────────────────────────────────────────────────

describe('getAnalysisHistory()', () => {
  it('returns paginated results with correct shape', async () => {
    const analysis1 = makeAnalysis({ id: 'id-1' });
    const analysis2 = makeAnalysis({ id: 'id-2' });
    const rows = [makeRow(analysis1), makeRow(analysis2)];

    const client = makeMockClient({ data: rows, error: null });

    const result = await getAnalysisHistory('user-123', { page: 1, pageSize: 10 }, client as unknown as SupabaseClient);

    expect(result.analyses).toHaveLength(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.total).toBe(2);
    // Verify camelCase mapping
    expect(result.analyses[0]?.userId).toBe('user-123');
    expect(result.analyses[0]?.fileName).toBe('resume.pdf');
  });

  it('filters by userId', async () => {
    const analysis = makeAnalysis({ userId: 'user-456' });
    const rows = [makeRow(analysis)];

    const qb = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({ data: rows, error: null }),
    };
    const client = { from: vi.fn().mockReturnValue(qb) } as unknown as SupabaseClient;

    await getAnalysisHistory('user-456', undefined, client);

    expect(qb.eq).toHaveBeenCalledWith('user_id', 'user-456');
  });

  it('uses default pagination (page=1, pageSize=10) when options are omitted', async () => {
    const qb = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const client = { from: vi.fn().mockReturnValue(qb) } as unknown as SupabaseClient;

    const result = await getAnalysisHistory('user-123', undefined, client);

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
    // Range should be 0-9 for page=1, pageSize=10
    expect(qb.range).toHaveBeenCalledWith(0, 9);
  });

  it('orders by uploaded_at descending', async () => {
    const qb = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const client = { from: vi.fn().mockReturnValue(qb) } as unknown as SupabaseClient;

    await getAnalysisHistory('user-123', undefined, client);

    expect(qb.order).toHaveBeenCalledWith('uploaded_at', { ascending: false });
  });

  it('uses Range header for pagination (page 2, pageSize 5)', async () => {
    const qb = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const client = { from: vi.fn().mockReturnValue(qb) } as unknown as SupabaseClient;

    await getAnalysisHistory('user-123', { page: 2, pageSize: 5 }, client);

    // page=2, pageSize=5 → rangeFrom=5, rangeTo=9
    expect(qb.range).toHaveBeenCalledWith(5, 9);
  });

  it('throws DatabaseError when query fails', async () => {
    const dbError = new Error('Query failed');
    const client = makeMockClient({ data: null, error: dbError });

    await expect(
      getAnalysisHistory('user-123', undefined, client as unknown as SupabaseClient),
    ).rejects.toThrow(DatabaseError);
  });

  it('maps DB rows back to ResumeAnalysis (snake_case → camelCase)', async () => {
    const analysis = makeAnalysis();
    const rows = [makeRow(analysis)];
    const client = makeMockClient({ data: rows, error: null });

    const result = await getAnalysisHistory('user-123', undefined, client as unknown as SupabaseClient);

    const mapped = result.analyses[0]!;
    expect(mapped.id).toBe(analysis.id);
    expect(mapped.userId).toBe(analysis.userId);
    expect(mapped.fileName).toBe(analysis.fileName);
    expect(mapped.parsedText).toBe(analysis.parsedText);
    expect(mapped.uploadedAt).toBeInstanceOf(Date);
    expect(mapped.score).toEqual(analysis.score);
    expect(mapped.ragMatches).toEqual(analysis.ragMatches);
    expect(mapped.llmFeedback).toEqual(analysis.llmFeedback);
    expect(mapped.metadata).toEqual(analysis.metadata);
  });
});

// ─── getAnalysisById ──────────────────────────────────────────────────────────

describe('getAnalysisById()', () => {
  it('returns analysis when found', async () => {
    const analysis = makeAnalysis();
    const rows = [makeRow(analysis)];
    const client = makeMockClient({ data: rows, error: null });

    const result = await getAnalysisById(analysis.id, analysis.userId, client as unknown as SupabaseClient);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(analysis.id);
    expect(result?.userId).toBe(analysis.userId);
  });

  it('returns null when not found', async () => {
    const client = makeMockClient({ data: [], error: null });

    const result = await getAnalysisById('nonexistent-id', 'user-123', client as unknown as SupabaseClient);

    expect(result).toBeNull();
  });

  it('enforces userId ownership (filters by both id AND userId)', async () => {
    const qb = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const client = { from: vi.fn().mockReturnValue(qb) } as unknown as SupabaseClient;

    await getAnalysisById('analysis-id', 'user-789', client);

    // Both id and user_id filters must be applied
    expect(qb.eq).toHaveBeenCalledWith('id', 'analysis-id');
    expect(qb.eq).toHaveBeenCalledWith('user_id', 'user-789');
  });

  it('throws DatabaseError when query fails', async () => {
    const dbError = new Error('DB error');
    const client = makeMockClient({ data: null, error: dbError });

    await expect(
      getAnalysisById('some-id', 'user-123', client as unknown as SupabaseClient),
    ).rejects.toThrow(DatabaseError);
  });

  it('returns null when data array is null (no rows)', async () => {
    const client = makeMockClient({ data: null, error: null });

    const result = await getAnalysisById('some-id', 'user-123', client as unknown as SupabaseClient);

    expect(result).toBeNull();
  });
});

// ─── AnalysisRepository class ─────────────────────────────────────────────────

describe('AnalysisRepository', () => {
  it('can be instantiated with a client', () => {
    const client = makeMockClient({ data: [], error: null });
    const repo = new AnalysisRepository(client as unknown as SupabaseClient);
    expect(repo).toBeInstanceOf(AnalysisRepository);
  });

  it('saveAnalysis delegates to the standalone function', async () => {
    const analysis = makeAnalysis();
    const client = makeMockClient({ data: [makeRow(analysis)], error: null });
    const repo = new AnalysisRepository(client as unknown as SupabaseClient);

    await expect(repo.saveAnalysis(analysis)).resolves.toBeUndefined();
  });

  it('saveAnalysisWithFallback delegates to the standalone function', async () => {
    const analysis = makeAnalysis();
    const client = makeMockClient({ data: [makeRow(analysis)], error: null });
    const repo = new AnalysisRepository(client as unknown as SupabaseClient);

    const result = await repo.saveAnalysisWithFallback(analysis);
    expect(result).toEqual({ saved: true, cached: false });
  });

  it('getAnalysisHistory delegates to the standalone function', async () => {
    const analysis = makeAnalysis();
    const rows = [makeRow(analysis)];
    const client = makeMockClient({ data: rows, error: null });
    const repo = new AnalysisRepository(client as unknown as SupabaseClient);

    const result = await repo.getAnalysisHistory('user-123');
    expect(result.analyses).toHaveLength(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  it('getAnalysisById delegates to the standalone function', async () => {
    const analysis = makeAnalysis();
    const rows = [makeRow(analysis)];
    const client = makeMockClient({ data: rows, error: null });
    const repo = new AnalysisRepository(client as unknown as SupabaseClient);

    const result = await repo.getAnalysisById(analysis.id, analysis.userId);
    expect(result?.id).toBe(analysis.id);
  });
});

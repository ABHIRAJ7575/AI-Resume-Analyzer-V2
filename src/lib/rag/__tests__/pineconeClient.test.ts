/**
 * Unit tests for PineconeClient
 * Requirements: 3.6, 10.1, 10.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PineconeClient } from '../pineconeClient';
import { RAGError } from '@/types/errors';
import type { RAGMatch } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_API_KEY = 'test-api-key';
const TEST_INDEX_HOST = 'https://test-index.svc.pinecone.io';

/** Build a minimal PineconeClient with test credentials. */
function makeClient(): PineconeClient {
  return new PineconeClient({ apiKey: TEST_API_KEY, indexHost: TEST_INDEX_HOST });
}

/** Build a mock fetch Response. */
function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Sample Pinecone query response with matches in non-sorted order. */
const sampleQueryResponse = {
  matches: [
    {
      id: 'vec-2',
      score: 0.75,
      metadata: { resumeType: 'template', industryTag: 'finance', qualityRating: 4, text: 'Finance resume' },
    },
    {
      id: 'vec-1',
      score: 0.95,
      metadata: { resumeType: 'user_submission', industryTag: 'tech', qualityRating: 5, text: 'Tech resume' },
    },
    {
      id: 'vec-3',
      score: 0.60,
      metadata: { resumeType: 'template', industryTag: 'healthcare', qualityRating: 3, text: 'Healthcare resume' },
    },
  ],
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ─── Constructor ──────────────────────────────────────────────────────────────

describe('PineconeClient constructor', () => {
  it('throws RAGError when no API key is provided', () => {
    // Ensure env var is not set
    const original = process.env['PINECONE_API_KEY'];
    delete process.env['PINECONE_API_KEY'];

    expect(() => new PineconeClient({ indexHost: TEST_INDEX_HOST })).toThrow(RAGError);
    expect(() => new PineconeClient({ indexHost: TEST_INDEX_HOST })).toThrow(/API key/);

    process.env['PINECONE_API_KEY'] = original;
  });

  it('throws RAGError when no index host or index name is provided', () => {
    const originalHost = process.env['PINECONE_INDEX_HOST'];
    const originalName = process.env['PINECONE_INDEX_NAME'];
    delete process.env['PINECONE_INDEX_HOST'];
    delete process.env['PINECONE_INDEX_NAME'];

    expect(() => new PineconeClient({ apiKey: TEST_API_KEY })).toThrow(RAGError);
    expect(() => new PineconeClient({ apiKey: TEST_API_KEY })).toThrow(/index host/);

    process.env['PINECONE_INDEX_HOST'] = originalHost;
    process.env['PINECONE_INDEX_NAME'] = originalName;
  });

  it('reads API key from environment variable', () => {
    process.env['PINECONE_API_KEY'] = 'env-api-key';
    expect(() => new PineconeClient({ indexHost: TEST_INDEX_HOST })).not.toThrow();
    delete process.env['PINECONE_API_KEY'];
  });
});

// ─── query() ─────────────────────────────────────────────────────────────────

describe('PineconeClient.query()', () => {
  it('returns RAGMatch[] sorted by score descending', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockResponse(sampleQueryResponse));

    const client = makeClient();
    const result = await client.query([0.1, 0.2, 0.3], 'default', 3);

    expect(result).toHaveLength(3);
    // Verify descending order
    expect(result[0]?.score).toBe(0.95);
    expect(result[1]?.score).toBe(0.75);
    expect(result[2]?.score).toBe(0.60);
  });

  it('maps match fields to RAGMatch shape correctly', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockResponse(sampleQueryResponse));

    const client = makeClient();
    const result = await client.query([0.1, 0.2], 'ns1', 3);

    const top = result[0] as RAGMatch;
    expect(top.id).toBe('vec-1');
    expect(top.score).toBe(0.95);
    expect(top.metadata.resumeType).toBe('user_submission');
    expect(top.metadata.industryTag).toBe('tech');
    expect(top.metadata.qualityRating).toBe(5);
    expect(top.text).toBe('Tech resume');
  });

  it('sends POST to /query with correct headers and body', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockResponse({ matches: [] }));

    const client = makeClient();
    const embedding = [0.1, 0.2, 0.3];
    await client.query(embedding, 'my-namespace', 5);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe(`${TEST_INDEX_HOST}/query`);
    expect((init.headers as Record<string, string>)['Api-Key']).toBe(TEST_API_KEY);
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body['vector']).toEqual(embedding);
    expect(body['topK']).toBe(5);
    expect(body['namespace']).toBe('my-namespace');
    expect(body['includeMetadata']).toBe(true);
    expect(body['includeValues']).toBe(false);
  });

  it('retries on 5xx errors and succeeds on the next attempt', async () => {
    const fetchMock = vi.mocked(fetch);
    // First call: 503, second call: success
    fetchMock
      .mockResolvedValueOnce(new Response('Service Unavailable', { status: 503, statusText: 'Service Unavailable' }))
      .mockResolvedValueOnce(mockResponse({ matches: [] }));

    // Stub sleep so the test doesn't actually wait
    vi.stubGlobal('setTimeout', (fn: () => void) => { fn(); return 0; });

    const client = makeClient();
    const result = await client.query([0.1], 'ns', 1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual([]);
  });

  it('throws RAGError after all 3 retries are exhausted on 5xx', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' }),
    );

    vi.stubGlobal('setTimeout', (fn: () => void) => { fn(); return 0; });

    const client = makeClient();
    await expect(client.query([0.1], 'ns', 1)).rejects.toThrow(RAGError);
    await expect(client.query([0.1], 'ns', 1)).rejects.toThrow(/all retries exhausted/);
  });

  it('throws RAGError immediately on 4xx (non-retryable)', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' }),
    );

    const client = makeClient();
    await expect(client.query([0.1], 'ns', 1)).rejects.toThrow(RAGError);
    await expect(client.query([0.1], 'ns', 1)).rejects.toThrow(/401/);

    // Should NOT retry — only 1 call per query invocation for 4xx
    expect(fetchMock).toHaveBeenCalledTimes(2); // 1 per query call above
  });

  it('throws RAGError on network failure after retries', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    vi.stubGlobal('setTimeout', (fn: () => void) => { fn(); return 0; });

    const client = makeClient();
    await expect(client.query([0.1], 'ns', 1)).rejects.toThrow(RAGError);
    await expect(client.query([0.1], 'ns', 1)).rejects.toThrow(/all retries exhausted/);
  });
});

// ─── upsert() ────────────────────────────────────────────────────────────────

describe('PineconeClient.upsert()', () => {
  it('sends POST to /vectors/upsert with correct endpoint and body', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockResponse({ upsertedCount: 1 }));

    const client = makeClient();
    const vectors = [
      {
        id: 'v1',
        values: [0.1, 0.2, 0.3],
        metadata: {
          resumeType: 'template' as const,
          industryTag: 'tech',
          qualityRating: 5,
          techStack: ['TypeScript'],
          experienceYears: 3,
          lastUpdated: new Date('2024-01-01'),
        },
      },
    ];

    await client.upsert(vectors);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe(`${TEST_INDEX_HOST}/vectors/upsert`);
    expect((init.headers as Record<string, string>)['Api-Key']).toBe(TEST_API_KEY);
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body['vectors']).toHaveLength(1);
  });

  it('throws RAGError when upsert returns a non-ok status', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response('Bad Request', { status: 400, statusText: 'Bad Request' }),
    );

    const client = makeClient();
    const promise = client.upsert([]);
    await expect(promise).rejects.toThrow(RAGError);
    await expect(promise).rejects.toThrow(/400/);
  });

  it('throws RAGError when the network request itself fails', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValue(new TypeError('Network error'));

    const client = makeClient();
    const promise = client.upsert([]);
    await expect(promise).rejects.toThrow(RAGError);
    await expect(promise).rejects.toThrow(/upsert request failed/);
  });
});

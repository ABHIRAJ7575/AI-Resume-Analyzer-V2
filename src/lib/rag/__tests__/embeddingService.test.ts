/**
 * Unit tests for embeddingService
 * Requirements: 3.1, 12.2, 12.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateEmbedding, clearEmbeddingCache } from '../embeddingService';
import { LLMError } from '@/types/errors';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIMS = 384;

/** Build a flat 384-dimensional embedding filled with a constant value. */
function makeFlat(value = 0.5): number[] {
  return Array.from({ length: DIMS }, () => value);
}

/** Build a 2-row nested embedding (token-level), each row filled with `value`. */
function makeNested(value = 0.4): number[][] {
  return [makeFlat(value), makeFlat(value)];
}

/** Build a mock fetch Response. */
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

// ─── generateEmbedding ────────────────────────────────────────────────────────

describe('generateEmbedding()', () => {
  it('returns a 384-dimensional array for a valid flat API response', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockResponse(makeFlat(0.5)));

    const result = await generateEmbedding('hello world');

    expect(result).toHaveLength(DIMS);
    expect(typeof result[0]).toBe('number');
  });

  it('returns cached result on second call with same text (fetch called only once)', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(mockResponse(makeFlat(0.3)));

    const first = await generateEmbedding('cache me');
    const second = await generateEmbedding('cache me');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it('calls fetch again for different text (no cross-key cache collision)', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(mockResponse(makeFlat(0.1)))
      .mockResolvedValueOnce(mockResponse(makeFlat(0.9)));

    await generateEmbedding('text A');
    await generateEmbedding('text B');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('handles nested (token-level) array response via mean pooling', async () => {
    const fetchMock = vi.mocked(fetch);
    // Two rows, each filled with 0.4 → mean is still 0.4
    fetchMock.mockResolvedValueOnce(mockResponse(makeNested(0.4)));

    const result = await generateEmbedding('nested response');

    expect(result).toHaveLength(DIMS);
    // Mean of [0.4, 0.4] = 0.4 for every dimension
    expect(result[0]).toBeCloseTo(0.4);
  });

  it('clamps values slightly outside [-1, 1] due to float precision', async () => {
    const fetchMock = vi.mocked(fetch);
    // Inject a value just above 1 and just below -1
    const raw = makeFlat(0.5);
    raw[0] = 1.0000001;
    raw[1] = -1.0000001;
    fetchMock.mockResolvedValueOnce(mockResponse(raw));

    const result = await generateEmbedding('clamp test');

    expect(result[0]).toBe(1);
    expect(result[1]).toBe(-1);
  });

  it('throws LLMError on non-200 API response', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' }),
    );

    await expect(generateEmbedding('fail-401')).rejects.toThrow(LLMError);

    // Second assertion: clear cache so fetch is called again, not served from cache
    clearEmbeddingCache();
    fetchMock.mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' }),
    );
    await expect(generateEmbedding('fail-401')).rejects.toThrow(/401/);
  });

  it('throws LLMError on network error', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(generateEmbedding('network fail')).rejects.toThrow(LLMError);

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(generateEmbedding('network fail')).rejects.toThrow(/network request failed/i);
  });

  it('throws LLMError on timeout (AbortError)', async () => {
    const fetchMock = vi.mocked(fetch);
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    fetchMock.mockRejectedValueOnce(abortError);

    await expect(generateEmbedding('timeout')).rejects.toThrow(LLMError);

    fetchMock.mockRejectedValueOnce(new DOMException('The operation was aborted.', 'AbortError'));
    await expect(generateEmbedding('timeout')).rejects.toThrow(/timed out/i);
  });

  it('throws LLMError when API returns wrong number of dimensions', async () => {
    const fetchMock = vi.mocked(fetch);
    // Return only 256 dimensions instead of 384
    fetchMock.mockResolvedValueOnce(mockResponse(Array.from({ length: 256 }, () => 0.1)));

    await expect(generateEmbedding('wrong dims')).rejects.toThrow(LLMError);

    fetchMock.mockResolvedValueOnce(mockResponse(Array.from({ length: 256 }, () => 0.1)));
    await expect(generateEmbedding('wrong dims')).rejects.toThrow(/384/);
  });

  it('throws LLMError when HF_API_KEY is not set', async () => {
    delete process.env['HF_API_KEY'];

    await expect(generateEmbedding('no key')).rejects.toThrow(LLMError);
    await expect(generateEmbedding('no key')).rejects.toThrow(/HF_API_KEY/);
  });

  it('sends POST to the correct HF endpoint with proper headers and body', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockResponse(makeFlat(0.2)));

    await generateEmbedding('check request');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toContain('api-inference.huggingface.co/pipeline/feature-extraction/');
    expect(url).toContain('sentence-transformers/all-MiniLM-L6-v2');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-hf-key');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body['inputs']).toBe('check request');
    expect((body['options'] as Record<string, unknown>)['wait_for_model']).toBe(true);
  });
});

// ─── clearEmbeddingCache ──────────────────────────────────────────────────────

describe('clearEmbeddingCache()', () => {
  it('clears the cache so the next call fetches from the API again', async () => {
    const fetchMock = vi.mocked(fetch);
    // Each call needs its own Response instance — a Response body can only be read once
    fetchMock
      .mockResolvedValueOnce(mockResponse(makeFlat(0.6)))
      .mockResolvedValueOnce(mockResponse(makeFlat(0.6)));

    await generateEmbedding('clear test');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    clearEmbeddingCache();

    await generateEmbedding('clear test');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

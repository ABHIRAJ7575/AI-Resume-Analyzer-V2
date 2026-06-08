/**
 * Unit tests for SupabaseClient and QueryBuilder.
 * Requirements: 5.1, 8.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SupabaseClient, createSupabaseClient } from '../supabaseClient';
import { DatabaseError } from '@/types/errors';

// ─── Constants ────────────────────────────────────────────────────────────────

const TEST_URL = 'https://test-project.supabase.co';
const TEST_KEY = 'test-service-role-key';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeClient(): SupabaseClient {
  return new SupabaseClient({ url: TEST_URL, serviceRoleKey: TEST_KEY });
}

function mockFetchResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ─── Constructor ──────────────────────────────────────────────────────────────

describe('SupabaseClient constructor', () => {
  it('throws DatabaseError when URL is missing', () => {
    const originalUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
    delete process.env['NEXT_PUBLIC_SUPABASE_URL'];

    expect(() => new SupabaseClient({ serviceRoleKey: TEST_KEY })).toThrow(DatabaseError);
    expect(() => new SupabaseClient({ serviceRoleKey: TEST_KEY })).toThrow(/URL/i);

    process.env['NEXT_PUBLIC_SUPABASE_URL'] = originalUrl;
  });

  it('throws DatabaseError when service role key is missing', () => {
    const originalKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
    delete process.env['SUPABASE_SERVICE_ROLE_KEY'];

    expect(() => new SupabaseClient({ url: TEST_URL })).toThrow(DatabaseError);
    expect(() => new SupabaseClient({ url: TEST_URL })).toThrow(/service role key/i);

    process.env['SUPABASE_SERVICE_ROLE_KEY'] = originalKey;
  });

  it('reads URL from NEXT_PUBLIC_SUPABASE_URL env var', () => {
    process.env['NEXT_PUBLIC_SUPABASE_URL'] = TEST_URL;
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = TEST_KEY;

    expect(() => new SupabaseClient()).not.toThrow();

    delete process.env['NEXT_PUBLIC_SUPABASE_URL'];
    delete process.env['SUPABASE_SERVICE_ROLE_KEY'];
  });

  it('reads service role key from SUPABASE_SERVICE_ROLE_KEY env var', () => {
    process.env['NEXT_PUBLIC_SUPABASE_URL'] = TEST_URL;
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = TEST_KEY;

    expect(() => new SupabaseClient()).not.toThrow();

    delete process.env['NEXT_PUBLIC_SUPABASE_URL'];
    delete process.env['SUPABASE_SERVICE_ROLE_KEY'];
  });

  it('accepts config override over env vars', () => {
    // Even if env vars are missing, explicit config should work
    const originalUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
    const originalKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
    delete process.env['NEXT_PUBLIC_SUPABASE_URL'];
    delete process.env['SUPABASE_SERVICE_ROLE_KEY'];

    expect(() => new SupabaseClient({ url: TEST_URL, serviceRoleKey: TEST_KEY })).not.toThrow();

    process.env['NEXT_PUBLIC_SUPABASE_URL'] = originalUrl;
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = originalKey;
  });
});

// ─── createSupabaseClient factory ─────────────────────────────────────────────

describe('createSupabaseClient()', () => {
  it('returns a SupabaseClient instance', () => {
    const client = createSupabaseClient({ url: TEST_URL, serviceRoleKey: TEST_KEY });
    expect(client).toBeInstanceOf(SupabaseClient);
  });

  it('throws DatabaseError when credentials are missing', () => {
    const originalUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
    const originalKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
    delete process.env['NEXT_PUBLIC_SUPABASE_URL'];
    delete process.env['SUPABASE_SERVICE_ROLE_KEY'];

    expect(() => createSupabaseClient()).toThrow(DatabaseError);

    process.env['NEXT_PUBLIC_SUPABASE_URL'] = originalUrl;
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = originalKey;
  });
});

// ─── from().insert().execute() ────────────────────────────────────────────────

describe('from().insert().execute()', () => {
  it('sends POST to /rest/v1/{table} with correct headers and body', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockFetchResponse([{ id: 'abc' }]));

    const client = makeClient();
    const data = { id: 'abc', user_id: 'user-1', file_name: 'resume.pdf' };
    const result = await client.from('analyses').insert(data).execute();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    // URL
    expect(url).toBe(`${TEST_URL}/rest/v1/analyses`);

    // Method
    expect(init.method).toBe('POST');

    // Auth headers
    const headers = init.headers as Record<string, string>;
    expect(headers['apikey']).toBe(TEST_KEY);
    expect(headers['Authorization']).toBe(`Bearer ${TEST_KEY}`);
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Prefer']).toContain('return=representation');

    // Body
    const body = JSON.parse(init.body as string) as typeof data;
    expect(body).toEqual(data);

    // Result
    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ id: 'abc' }]);
  });

  it('returns { data: null, error: Error } on non-ok response', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'duplicate key' }), {
        status: 409,
        statusText: 'Conflict',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const client = makeClient();
    const result = await client.from('analyses').insert({ id: 'dup' }).execute();

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toContain('duplicate key');
  });
});

// ─── from().select().eq().execute() ──────────────────────────────────────────

describe('from().select().eq().execute()', () => {
  it('sends GET with correct query params for eq filter', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockFetchResponse([{ id: 'row-1' }]));

    const client = makeClient();
    await client.from('analyses').select('*').eq('user_id', 'user-123').execute();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(init.method).toBe('GET');
    expect(url).toContain('user_id=eq.user-123');
    expect(url).toContain('/rest/v1/analyses');
  });

  it('supports chaining multiple eq filters', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockFetchResponse([]));

    const client = makeClient();
    await client
      .from('analyses')
      .select('*')
      .eq('id', 'some-id')
      .eq('user_id', 'user-456')
      .execute();

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('id=eq.some-id');
    expect(url).toContain('user_id=eq.user-456');
  });

  it('includes apikey and Authorization headers on GET requests', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockFetchResponse([]));

    const client = makeClient();
    await client.from('analyses').select('*').execute();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['apikey']).toBe(TEST_KEY);
    expect(headers['Authorization']).toBe(`Bearer ${TEST_KEY}`);
  });

  it('returns data array on success', async () => {
    const rows = [{ id: 'r1' }, { id: 'r2' }];
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockFetchResponse(rows));

    const client = makeClient();
    const result = await client.from('analyses').select('*').execute();

    expect(result.error).toBeNull();
    expect(result.data).toEqual(rows);
  });
});

// ─── from().select().range().execute() ───────────────────────────────────────

describe('from().select().range().execute()', () => {
  it('sends GET with Range header for pagination', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockFetchResponse([{ id: 'r1' }]));

    const client = makeClient();
    await client.from('analyses').select('*').range(0, 9).execute();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(headers['Range']).toBe('0-9');
  });

  it('sets Range-Unit header to items', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockFetchResponse([]));

    const client = makeClient();
    await client.from('analyses').select('*').range(10, 19).execute();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Range-Unit']).toBe('items');
  });

  it('includes count=exact in Prefer header when range is set', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockFetchResponse([]));

    const client = makeClient();
    await client.from('analyses').select('*').range(0, 4).execute();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Prefer']).toContain('count=exact');
  });
});

// ─── Non-ok response handling ─────────────────────────────────────────────────

describe('QueryBuilder error handling', () => {
  it('returns { data: null, error: Error } on non-ok response', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response('Internal Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      }),
    );

    const client = makeClient();
    const result = await client.from('analyses').select('*').execute();

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toContain('500');
  });

  it('returns { data: null, error: Error } on network failure', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const client = makeClient();
    const result = await client.from('analyses').select('*').execute();

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
  });

  it('returns { data: [], error: null } on 204 No Content', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = makeClient();
    const result = await client.from('analyses').select('*').execute();

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });
});

// ─── order() ─────────────────────────────────────────────────────────────────

describe('from().select().order().execute()', () => {
  it('adds order query param ascending by default', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockFetchResponse([]));

    const client = makeClient();
    await client.from('analyses').select('*').order('uploaded_at').execute();

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('order=uploaded_at.asc');
  });

  it('adds order query param descending when ascending=false', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockFetchResponse([]));

    const client = makeClient();
    await client
      .from('analyses')
      .select('*')
      .order('uploaded_at', { ascending: false })
      .execute();

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('order=uploaded_at.desc');
  });
});

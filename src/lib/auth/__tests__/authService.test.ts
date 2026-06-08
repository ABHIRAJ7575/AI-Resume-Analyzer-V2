/**
 * Unit tests for authService.ts
 * Requirements: 8.1, 8.2, 8.3, 8.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  signUp,
  signIn,
  signOut,
  refreshSession,
  deleteAccount,
} from '../authService';
import { AuthenticationError } from '@/types/errors';

// ─── Constants ────────────────────────────────────────────────────────────────

const TEST_URL = 'https://test-project.supabase.co';
const TEST_ANON_KEY = 'test-anon-key';
const TEST_SERVICE_KEY = 'test-service-role-key';

const MOCK_USER = {
  id: 'user-uuid-123',
  email: 'test@example.com',
  created_at: '2024-01-01T00:00:00.000Z',
};

const MOCK_AUTH_RESPONSE = {
  access_token: 'access-token-abc',
  refresh_token: 'refresh-token-xyz',
  expires_in: 3600,
  user: MOCK_USER,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockOkResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockErrorResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  process.env['NEXT_PUBLIC_SUPABASE_URL'] = TEST_URL;
  process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] = TEST_ANON_KEY;
  process.env['SUPABASE_SERVICE_ROLE_KEY'] = TEST_SERVICE_KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env['NEXT_PUBLIC_SUPABASE_URL'];
  delete process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  delete process.env['SUPABASE_SERVICE_ROLE_KEY'];
});

// ─── signUp ───────────────────────────────────────────────────────────────────

describe('signUp()', () => {
  it('returns AuthSession on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOkResponse(MOCK_AUTH_RESPONSE));

    const session = await signUp('test@example.com', 'password123');

    expect(session.accessToken).toBe('access-token-abc');
    expect(session.refreshToken).toBe('refresh-token-xyz');
    expect(session.user.id).toBe('user-uuid-123');
    expect(session.user.email).toBe('test@example.com');
    expect(session.user.createdAt).toBeInstanceOf(Date);
    expect(session.expiresAt).toBeInstanceOf(Date);
    // expiresAt should be roughly now + 3600s
    const expectedExpiry = Date.now() + 3600 * 1000;
    expect(session.expiresAt.getTime()).toBeGreaterThan(expectedExpiry - 5000);
    expect(session.expiresAt.getTime()).toBeLessThan(expectedExpiry + 5000);
  });

  it('calls the correct endpoint with correct headers and body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOkResponse(MOCK_AUTH_RESPONSE));

    await signUp('test@example.com', 'password123');

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${TEST_URL}/auth/v1/signup`);
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['apikey']).toBe(TEST_ANON_KEY);
    const body = JSON.parse(init.body as string) as { email: string; password: string };
    expect(body).toEqual({ email: 'test@example.com', password: 'password123' });
  });

  it('throws AuthenticationError on 4xx response', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockErrorResponse({ error: 'User already registered' }, 422))
      .mockResolvedValueOnce(mockErrorResponse({ error: 'User already registered' }, 422));

    await expect(signUp('existing@example.com', 'password123')).rejects.toThrow(
      AuthenticationError,
    );
    await expect(signUp('existing@example.com', 'password123')).rejects.toThrow(
      /User already registered/,
    );
  });
});

// ─── signIn ───────────────────────────────────────────────────────────────────

describe('signIn()', () => {
  it('returns AuthSession with correct expiry', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOkResponse(MOCK_AUTH_RESPONSE));

    const before = Date.now();
    const session = await signIn('test@example.com', 'password123');
    const after = Date.now();

    expect(session.accessToken).toBe('access-token-abc');
    expect(session.refreshToken).toBe('refresh-token-xyz');
    expect(session.user.id).toBe('user-uuid-123');
    expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 3600 * 1000);
    expect(session.expiresAt.getTime()).toBeLessThanOrEqual(after + 3600 * 1000);
  });

  it('calls the correct endpoint with grant_type=password', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOkResponse(MOCK_AUTH_RESPONSE));

    await signIn('test@example.com', 'password123');

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${TEST_URL}/auth/v1/token?grant_type=password`);
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['apikey']).toBe(TEST_ANON_KEY);
  });

  it('throws AuthenticationError on invalid credentials', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        mockErrorResponse({ error_description: 'Invalid login credentials' }, 400),
      )
      .mockResolvedValueOnce(
        mockErrorResponse({ error_description: 'Invalid login credentials' }, 400),
      );

    await expect(signIn('test@example.com', 'wrongpassword')).rejects.toThrow(
      AuthenticationError,
    );
    await expect(signIn('test@example.com', 'wrongpassword')).rejects.toThrow(
      /Invalid login credentials/,
    );
  });
});

// ─── signOut ──────────────────────────────────────────────────────────────────

describe('signOut()', () => {
  it('calls the correct endpoint with Bearer token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await signOut('my-access-token');

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${TEST_URL}/auth/v1/logout`);
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer my-access-token');
    expect(headers['apikey']).toBe(TEST_ANON_KEY);
  });

  it('resolves without error on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(signOut('my-access-token')).resolves.toBeUndefined();
  });

  it('throws AuthenticationError on failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockErrorResponse({ message: 'Invalid token' }, 401),
    );

    await expect(signOut('bad-token')).rejects.toThrow(AuthenticationError);
  });
});

// ─── refreshSession ───────────────────────────────────────────────────────────

describe('refreshSession()', () => {
  it('returns new AuthSession on success', async () => {
    const refreshedResponse = {
      ...MOCK_AUTH_RESPONSE,
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
    };
    vi.mocked(fetch).mockResolvedValueOnce(mockOkResponse(refreshedResponse));

    const session = await refreshSession('old-refresh-token');

    expect(session.accessToken).toBe('new-access-token');
    expect(session.refreshToken).toBe('new-refresh-token');
    expect(session.user.id).toBe('user-uuid-123');
  });

  it('calls the correct endpoint with grant_type=refresh_token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockOkResponse(MOCK_AUTH_RESPONSE));

    await refreshSession('my-refresh-token');

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${TEST_URL}/auth/v1/token?grant_type=refresh_token`);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as { refresh_token: string };
    expect(body.refresh_token).toBe('my-refresh-token');
  });

  it('throws AuthenticationError on failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockErrorResponse({ error: 'Invalid refresh token' }, 400),
    );

    await expect(refreshSession('bad-refresh-token')).rejects.toThrow(AuthenticationError);
  });
});

// ─── deleteAccount ────────────────────────────────────────────────────────────

describe('deleteAccount()', () => {
  it('calls admin delete endpoint and analyses delete endpoint', async () => {
    // First call: delete analyses, second call: delete user
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 204 })) // analyses DELETE
      .mockResolvedValueOnce(new Response(null, { status: 204 })); // admin user DELETE

    await deleteAccount('user-uuid-123', 'access-token-abc');

    expect(fetch).toHaveBeenCalledTimes(2);

    const [analysesUrl, analysesInit] = vi.mocked(fetch).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(analysesUrl).toContain('/rest/v1/analyses');
    expect(analysesUrl).toContain('user_id=eq.user-uuid-123');
    expect(analysesInit.method).toBe('DELETE');
    const analysesHeaders = analysesInit.headers as Record<string, string>;
    expect(analysesHeaders['Authorization']).toBe(`Bearer ${TEST_SERVICE_KEY}`);

    const [adminUrl, adminInit] = vi.mocked(fetch).mock.calls[1] as [string, RequestInit];
    expect(adminUrl).toBe(`${TEST_URL}/auth/v1/admin/users/user-uuid-123`);
    expect(adminInit.method).toBe('DELETE');
    const adminHeaders = adminInit.headers as Record<string, string>;
    expect(adminHeaders['Authorization']).toBe(`Bearer ${TEST_SERVICE_KEY}`);
  });

  it('throws AuthenticationError when analyses delete fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockErrorResponse({ message: 'Forbidden' }, 403),
    );

    await expect(deleteAccount('user-uuid-123', 'access-token-abc')).rejects.toThrow(
      AuthenticationError,
    );
  });

  it('throws AuthenticationError when admin user delete fails', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 204 })) // analyses OK
      .mockResolvedValueOnce(mockErrorResponse({ message: 'User not found' }, 404)) // admin fails
      .mockResolvedValueOnce(new Response(null, { status: 204 })) // analyses OK (2nd call)
      .mockResolvedValueOnce(mockErrorResponse({ message: 'User not found' }, 404)); // admin fails (2nd call)

    await expect(deleteAccount('user-uuid-123', 'access-token-abc')).rejects.toThrow(
      AuthenticationError,
    );
    await expect(deleteAccount('user-uuid-123', 'access-token-abc')).rejects.toThrow(
      /User not found/,
    );
  });
});

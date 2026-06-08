/**
 * Supabase Auth REST API service using native fetch (no @supabase/supabase-js).
 * Requirements: 8.1, 8.2, 8.3, 8.6
 */

import { AuthenticationError } from '@/types/errors';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  createdAt: Date;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  user: AuthUser;
}

/** Raw shape returned by Supabase Auth REST API */
interface SupabaseAuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    created_at: string;
  };
}

/** Raw shape returned by Supabase Auth error responses */
interface SupabaseAuthError {
  error?: string;
  error_description?: string;
  message?: string;
  msg?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAuthBaseUrl(): string {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  if (!url) {
    throw new AuthenticationError(
      'Supabase URL is required. Set NEXT_PUBLIC_SUPABASE_URL environment variable.',
    );
  }
  return `${url.replace(/\/$/, '')}/auth/v1`;
}

function getAnonKey(): string {
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!key) {
    throw new AuthenticationError(
      'Supabase anon key is required. Set NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.',
    );
  }
  return key;
}

function getServiceRoleKey(): string {
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!key) {
    throw new AuthenticationError(
      'Supabase service role key is required. Set SUPABASE_SERVICE_ROLE_KEY environment variable.',
    );
  }
  return key;
}

function mapToAuthSession(data: SupabaseAuthResponse): AuthSession {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    user: {
      id: data.user.id,
      email: data.user.email,
      createdAt: new Date(data.user.created_at),
    },
  };
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as SupabaseAuthError;
    return (
      body.error_description ??
      body.error ??
      body.message ??
      body.msg ??
      `Request failed with status ${response.status}`
    );
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

// ─── Exported functions ───────────────────────────────────────────────────────

/**
 * Sign up a new user with email and password.
 * Requirements: 8.1
 */
export async function signUp(email: string, password: string): Promise<AuthSession> {
  const baseUrl = getAuthBaseUrl();
  const anonKey = getAnonKey();

  const response = await fetch(`${baseUrl}/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new AuthenticationError(`Sign up failed: ${message}`);
  }

  const data = (await response.json()) as SupabaseAuthResponse;
  return mapToAuthSession(data);
}

/**
 * Sign in an existing user with email and password.
 * Requirements: 8.2
 */
export async function signIn(email: string, password: string): Promise<AuthSession> {
  const baseUrl = getAuthBaseUrl();
  const anonKey = getAnonKey();

  const response = await fetch(`${baseUrl}/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new AuthenticationError(`Sign in failed: ${message}`);
  }

  const data = (await response.json()) as SupabaseAuthResponse;
  return mapToAuthSession(data);
}

/**
 * Sign out the current user by invalidating their access token.
 * Requirements: 8.3
 */
export async function signOut(accessToken: string): Promise<void> {
  const baseUrl = getAuthBaseUrl();
  const anonKey = getAnonKey();

  const response = await fetch(`${baseUrl}/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new AuthenticationError(`Sign out failed: ${message}`);
  }
}

/**
 * Refresh an existing session using a refresh token.
 * Requirements: 8.3
 */
export async function refreshSession(refreshToken: string): Promise<AuthSession> {
  const baseUrl = getAuthBaseUrl();
  const anonKey = getAnonKey();

  const response = await fetch(`${baseUrl}/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new AuthenticationError(`Session refresh failed: ${message}`);
  }

  const data = (await response.json()) as SupabaseAuthResponse;
  return mapToAuthSession(data);
}

/**
 * Delete a user account and all associated analyses.
 * Requirements: 8.6
 */
export async function deleteAccount(userId: string, accessToken: string): Promise<void> {
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  if (!supabaseUrl) {
    throw new AuthenticationError(
      'Supabase URL is required. Set NEXT_PUBLIC_SUPABASE_URL environment variable.',
    );
  }
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const serviceRoleKey = getServiceRoleKey();

  // Validate the caller is authenticated (accessToken must be present)
  if (!accessToken) {
    throw new AuthenticationError('Access token is required to delete account.');
  }

  // 1. Delete all analyses for this user via REST API
  const analysesResponse = await fetch(
    `${baseUrl}/rest/v1/analyses?user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
    },
  );

  if (!analysesResponse.ok) {
    const message = await extractErrorMessage(analysesResponse);
    throw new AuthenticationError(`Failed to delete user analyses: ${message}`);
  }

  // 2. Delete the user via Admin API
  const deleteUserResponse = await fetch(`${baseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!deleteUserResponse.ok) {
    const message = await extractErrorMessage(deleteUserResponse);
    throw new AuthenticationError(`Failed to delete user account: ${message}`);
  }
}

// ─── AuthService class ────────────────────────────────────────────────────────

/**
 * Class-based wrapper around the auth functions.
 * Requirements: 8.1, 8.2, 8.3, 8.6
 */
export class AuthService {
  async signUp(email: string, password: string): Promise<AuthSession> {
    return signUp(email, password);
  }

  async signIn(email: string, password: string): Promise<AuthSession> {
    return signIn(email, password);
  }

  async signOut(accessToken: string): Promise<void> {
    return signOut(accessToken);
  }

  async refreshSession(refreshToken: string): Promise<AuthSession> {
    return refreshSession(refreshToken);
  }

  async deleteAccount(userId: string, accessToken: string): Promise<void> {
    return deleteAccount(userId, accessToken);
  }
}

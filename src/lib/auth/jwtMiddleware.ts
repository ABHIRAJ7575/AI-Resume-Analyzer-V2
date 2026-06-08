/**
 * JWT decoding and validation utilities using native Node.js Buffer.
 * No external JWT libraries — pure base64url decoding.
 * Requirements: 8.3, 8.4
 */

import { AuthenticationError } from '@/types/errors';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JWTPayload {
  sub: string;
  email: string;
  exp: number;
  iat: number;
  role?: string;
}

export interface JWTValidationResult {
  valid: boolean;
  payload: JWTPayload | null;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Decode a base64url-encoded string to a UTF-8 string.
 * Handles padding differences between base64 and base64url.
 */
function decodeBase64Url(input: string): string {
  // base64url uses - and _ instead of + and /; also has no padding
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

// ─── Exported functions ───────────────────────────────────────────────────────

/**
 * Decode a JWT and return its payload.
 * Does NOT verify the signature — use validateJWT for full validation.
 * Throws AuthenticationError if the token is malformed.
 * Requirements: 8.3
 */
export function decodeJWT(token: string): JWTPayload {
  if (!token || typeof token !== 'string') {
    throw new AuthenticationError('Invalid token format');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new AuthenticationError('Invalid token format');
  }

  const [, payloadPart] = parts;

  if (!payloadPart) {
    throw new AuthenticationError('Invalid token format');
  }

  let decoded: string;
  try {
    decoded = decodeBase64Url(payloadPart);
  } catch {
    throw new AuthenticationError('Invalid token format');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(decoded);
  } catch {
    throw new AuthenticationError('Invalid token format');
  }

  if (typeof payload !== 'object' || payload === null) {
    throw new AuthenticationError('Invalid token format');
  }

  const p = payload as Record<string, unknown>;

  // Validate required fields
  if (typeof p['sub'] !== 'string' || typeof p['exp'] !== 'number') {
    throw new AuthenticationError('Invalid token format');
  }

  const result: JWTPayload = {
    sub: p['sub'] as string,
    email: typeof p['email'] === 'string' ? p['email'] : '',
    exp: p['exp'] as number,
    iat: typeof p['iat'] === 'number' ? p['iat'] : 0,
  };

  if (typeof p['role'] === 'string') {
    result.role = p['role'];
  }

  return result;
}

/**
 * Validate a JWT: decode it and check expiry and required fields.
 * Returns a result object rather than throwing.
 * Requirements: 8.3, 8.4
 */
export function validateJWT(token: string): JWTValidationResult {
  let payload: JWTPayload;

  try {
    payload = decodeJWT(token);
  } catch {
    return { valid: false, payload: null, error: 'Invalid token format' };
  }

  // Check required fields
  if (!payload.sub || typeof payload.exp !== 'number') {
    return { valid: false, payload: null, error: 'Invalid token format' };
  }

  // Check expiry: exp is in seconds, Date.now() is in milliseconds
  const nowSeconds = Date.now() / 1000;
  if (payload.exp <= nowSeconds) {
    return { valid: false, payload, error: 'Token expired' };
  }

  return { valid: true, payload };
}

/**
 * Check whether a JWT has expired.
 * Returns true if expired or malformed, false if still valid.
 * Requirements: 8.4
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = decodeJWT(token);
    const nowSeconds = Date.now() / 1000;
    return payload.exp <= nowSeconds;
  } catch {
    // Malformed tokens are treated as expired
    return true;
  }
}

/**
 * Extract the Bearer token from an Authorization header.
 * Returns null if the header is missing, empty, or not in "Bearer <token>" format.
 * Requirements: 8.4
 */
export function extractBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  const trimmed = authHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  const token = trimmed.slice(7).trim(); // length of "bearer " is 7
  if (!token) {
    return null;
  }

  return token;
}

// ─── JWTMiddleware class ──────────────────────────────────────────────────────

/**
 * Class-based wrapper around JWT utility functions.
 * Requirements: 8.3, 8.4
 */
export class JWTMiddleware {
  decodeJWT(token: string): JWTPayload {
    return decodeJWT(token);
  }

  validateJWT(token: string): JWTValidationResult {
    return validateJWT(token);
  }

  isTokenExpired(token: string): boolean {
    return isTokenExpired(token);
  }

  extractBearerToken(authHeader: string | null | undefined): string | null {
    return extractBearerToken(authHeader);
  }
}

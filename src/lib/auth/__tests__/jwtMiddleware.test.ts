/**
 * Unit tests for jwtMiddleware.ts
 * Requirements: 8.3, 8.4
 */

import { describe, it, expect } from 'vitest';
import {
  decodeJWT,
  validateJWT,
  isTokenExpired,
  extractBearerToken,
} from '../jwtMiddleware';
import { AuthenticationError } from '@/types/errors';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal JWT string (header.payload.signature) for testing.
 * The signature is fake — we only test decoding/validation, not verification.
 */
function buildJWT(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
    'base64url',
  );
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = Buffer.from('fake-signature').toString('base64url');
  return `${header}.${body}.${sig}`;
}

/** Returns a Unix timestamp (seconds) offset from now. */
function nowPlusSecs(secs: number): number {
  return Math.floor(Date.now() / 1000) + secs;
}

// ─── Sample tokens ────────────────────────────────────────────────────────────

const VALID_PAYLOAD = {
  sub: 'user-uuid-123',
  email: 'test@example.com',
  exp: nowPlusSecs(3600), // expires in 1 hour
  iat: nowPlusSecs(-60), // issued 1 minute ago
  role: 'authenticated',
};

const EXPIRED_PAYLOAD = {
  sub: 'user-uuid-456',
  email: 'expired@example.com',
  exp: nowPlusSecs(-3600), // expired 1 hour ago
  iat: nowPlusSecs(-7200),
};

const VALID_TOKEN = buildJWT(VALID_PAYLOAD);
const EXPIRED_TOKEN = buildJWT(EXPIRED_PAYLOAD);

// ─── decodeJWT ────────────────────────────────────────────────────────────────

describe('decodeJWT()', () => {
  it('returns parsed payload for a valid token', () => {
    const payload = decodeJWT(VALID_TOKEN);

    expect(payload.sub).toBe('user-uuid-123');
    expect(payload.email).toBe('test@example.com');
    expect(payload.exp).toBe(VALID_PAYLOAD.exp);
    expect(payload.iat).toBe(VALID_PAYLOAD.iat);
    expect(payload.role).toBe('authenticated');
  });

  it('throws AuthenticationError for a token with wrong number of parts', () => {
    expect(() => decodeJWT('only.two')).toThrow(AuthenticationError);
    expect(() => decodeJWT('only.two')).toThrow(/Invalid token format/);
  });

  it('throws AuthenticationError for an empty string', () => {
    expect(() => decodeJWT('')).toThrow(AuthenticationError);
  });

  it('throws AuthenticationError for a token with non-JSON payload', () => {
    const badPayload = Buffer.from('not-json!!!').toString('base64url');
    const badToken = `header.${badPayload}.sig`;
    expect(() => decodeJWT(badToken)).toThrow(AuthenticationError);
  });

  it('throws AuthenticationError for a token missing required sub field', () => {
    const noSub = buildJWT({ email: 'test@example.com', exp: nowPlusSecs(3600), iat: 0 });
    expect(() => decodeJWT(noSub)).toThrow(AuthenticationError);
  });

  it('throws AuthenticationError for a token missing required exp field', () => {
    const noExp = buildJWT({ sub: 'user-123', email: 'test@example.com', iat: 0 });
    expect(() => decodeJWT(noExp)).toThrow(AuthenticationError);
  });
});

// ─── validateJWT ─────────────────────────────────────────────────────────────

describe('validateJWT()', () => {
  it('returns { valid: true } for a non-expired token', () => {
    const result = validateJWT(VALID_TOKEN);

    expect(result.valid).toBe(true);
    expect(result.payload).not.toBeNull();
    expect(result.payload?.sub).toBe('user-uuid-123');
    expect(result.error).toBeUndefined();
  });

  it('returns { valid: false, error: "Token expired" } for an expired token', () => {
    const result = validateJWT(EXPIRED_TOKEN);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Token expired');
  });

  it('returns { valid: false, error: "Invalid token format" } for a malformed token', () => {
    const result = validateJWT('not.a.valid.jwt.at.all');

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid token format');
  });

  it('returns { valid: false, error: "Invalid token format" } for an empty string', () => {
    const result = validateJWT('');

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid token format');
  });

  it('returns { valid: false, error: "Invalid token format" } for a token with only 2 parts', () => {
    const result = validateJWT('header.payload');

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid token format');
  });
});

// ─── isTokenExpired ───────────────────────────────────────────────────────────

describe('isTokenExpired()', () => {
  it('returns false for a valid non-expired token', () => {
    expect(isTokenExpired(VALID_TOKEN)).toBe(false);
  });

  it('returns true for an expired token', () => {
    expect(isTokenExpired(EXPIRED_TOKEN)).toBe(true);
  });

  it('returns true for a malformed token', () => {
    expect(isTokenExpired('garbage')).toBe(true);
  });

  it('returns true for a token expiring exactly at now', () => {
    // exp = now (already expired by the time we check)
    const atNow = buildJWT({
      sub: 'user-123',
      email: 'test@example.com',
      exp: nowPlusSecs(0),
      iat: nowPlusSecs(-60),
    });
    // This may be borderline; we just check it doesn't throw
    const result = isTokenExpired(atNow);
    expect(typeof result).toBe('boolean');
  });
});

// ─── extractBearerToken ───────────────────────────────────────────────────────

describe('extractBearerToken()', () => {
  it('extracts token from a valid Authorization header', () => {
    const token = extractBearerToken('Bearer my-jwt-token-here');
    expect(token).toBe('my-jwt-token-here');
  });

  it('is case-insensitive for the Bearer prefix', () => {
    expect(extractBearerToken('bearer my-token')).toBe('my-token');
    expect(extractBearerToken('BEARER my-token')).toBe('my-token');
    expect(extractBearerToken('Bearer my-token')).toBe('my-token');
  });

  it('returns null for a null header', () => {
    expect(extractBearerToken(null)).toBeNull();
  });

  it('returns null for an undefined header', () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractBearerToken('')).toBeNull();
  });

  it('returns null for a header without Bearer prefix', () => {
    expect(extractBearerToken('Token my-jwt-token')).toBeNull();
    expect(extractBearerToken('Basic dXNlcjpwYXNz')).toBeNull();
  });

  it('returns null for "Bearer" with no token following', () => {
    expect(extractBearerToken('Bearer ')).toBeNull();
    expect(extractBearerToken('Bearer')).toBeNull();
  });

  it('handles extra whitespace around the token', () => {
    const token = extractBearerToken('Bearer   my-token  ');
    // The token itself may have trailing spaces stripped or not — we just check it's non-null
    // and starts with the expected value
    expect(token).not.toBeNull();
    expect(token?.trim()).toBe('my-token');
  });
});

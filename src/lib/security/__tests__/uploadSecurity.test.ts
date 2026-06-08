/**
 * Unit tests for uploadSecurity utilities.
 *
 * Tests:
 *   - scanForMaliciousContent: pattern detection
 *   - getClientIP: IP extraction from headers
 *   - enforceUploadRateLimit: rate limit enforcement
 *   - validatePDFBuffer: magic bytes + size delegation
 *   - runUploadSecurityChecks: combined security pipeline
 *
 * Requirements: 11.3, 1.4, 9.6
 */

import { describe, it, expect } from 'vitest';
import {
  scanForMaliciousContent,
  getClientIP,
  enforceUploadRateLimit,
  validatePDFBuffer,
  runUploadSecurityChecks,
} from '../uploadSecurity';
import { ValidationError, RateLimitError } from '@/types/errors';
import { InMemoryRateLimitStore } from '@/lib/rateLimit/rateLimitStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal valid PDF buffer (magic bytes + padding). */
function makePdfBuffer(extraBytes = 200): Buffer {
  const buf = Buffer.alloc(4 + extraBytes, 0x20);
  buf[0] = 0x25; // %
  buf[1] = 0x50; // P
  buf[2] = 0x44; // D
  buf[3] = 0x46; // F
  return buf;
}

/** Build a buffer that does NOT start with %PDF. */
function makeNonPdfBuffer(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
}

/** Build a Request with the given headers. */
function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/upload', {
    method: 'POST',
    headers,
  });
}

// ─── scanForMaliciousContent ──────────────────────────────────────────────────

describe('scanForMaliciousContent()', () => {
  it('returns isSuspicious=false for a clean PDF buffer', () => {
    const result = scanForMaliciousContent(makePdfBuffer());
    expect(result.isSuspicious).toBe(false);
    expect(result.detectedPatterns).toHaveLength(0);
  });

  it('detects /JS pattern', () => {
    const buf = Buffer.concat([makePdfBuffer(), Buffer.from('/JS ')]);
    const result = scanForMaliciousContent(buf);
    expect(result.isSuspicious).toBe(true);
    expect(result.detectedPatterns.some((p) => p.includes('/JS'))).toBe(true);
  });

  it('detects /JavaScript pattern', () => {
    const buf = Buffer.concat([makePdfBuffer(), Buffer.from('/JavaScript ')]);
    const result = scanForMaliciousContent(buf);
    expect(result.isSuspicious).toBe(true);
    expect(result.detectedPatterns.some((p) => p.includes('/JavaScript'))).toBe(true);
  });

  it('detects /Launch pattern', () => {
    const buf = Buffer.concat([makePdfBuffer(), Buffer.from('/Launch ')]);
    const result = scanForMaliciousContent(buf);
    expect(result.isSuspicious).toBe(true);
    expect(result.detectedPatterns.some((p) => p.includes('/Launch'))).toBe(true);
  });

  it('detects /EmbeddedFile pattern', () => {
    const buf = Buffer.concat([makePdfBuffer(), Buffer.from('/EmbeddedFile ')]);
    const result = scanForMaliciousContent(buf);
    expect(result.isSuspicious).toBe(true);
    expect(result.detectedPatterns.some((p) => p.includes('/EmbeddedFile'))).toBe(true);
  });

  it('detects /OpenAction pattern', () => {
    const buf = Buffer.concat([makePdfBuffer(), Buffer.from('/OpenAction ')]);
    const result = scanForMaliciousContent(buf);
    expect(result.isSuspicious).toBe(true);
    expect(result.detectedPatterns.some((p) => p.includes('/OpenAction'))).toBe(true);
  });

  it('detects /XFA pattern', () => {
    const buf = Buffer.concat([makePdfBuffer(), Buffer.from('/XFA ')]);
    const result = scanForMaliciousContent(buf);
    expect(result.isSuspicious).toBe(true);
    expect(result.detectedPatterns.some((p) => p.includes('/XFA'))).toBe(true);
  });

  it('reports multiple detected patterns', () => {
    const buf = Buffer.concat([
      makePdfBuffer(),
      Buffer.from('/JS '),
      Buffer.from('/Launch '),
    ]);
    const result = scanForMaliciousContent(buf);
    expect(result.isSuspicious).toBe(true);
    expect(result.detectedPatterns.length).toBeGreaterThanOrEqual(2);
  });

  it('returns isSuspicious=false for an empty buffer', () => {
    const result = scanForMaliciousContent(Buffer.alloc(0));
    expect(result.isSuspicious).toBe(false);
  });
});

// ─── getClientIP ──────────────────────────────────────────────────────────────

describe('getClientIP()', () => {
  it('returns the first IP from x-forwarded-for', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
    expect(getClientIP(req)).toBe('1.2.3.4');
  });

  it('returns x-real-ip when x-forwarded-for is absent', () => {
    const req = makeRequest({ 'x-real-ip': '9.10.11.12' });
    expect(getClientIP(req)).toBe('9.10.11.12');
  });

  it('returns "unknown" when no IP headers are present', () => {
    const req = makeRequest();
    expect(getClientIP(req)).toBe('unknown');
  });

  it('trims whitespace from x-forwarded-for entries', () => {
    const req = makeRequest({ 'x-forwarded-for': '  192.168.1.1  , 10.0.0.1' });
    expect(getClientIP(req)).toBe('192.168.1.1');
  });
});

// ─── validatePDFBuffer ────────────────────────────────────────────────────────

describe('validatePDFBuffer()', () => {
  it('does not throw for a valid PDF buffer', () => {
    expect(() => validatePDFBuffer(makePdfBuffer())).not.toThrow();
  });

  it('throws ValidationError for a non-PDF buffer', () => {
    expect(() => validatePDFBuffer(makeNonPdfBuffer())).toThrow(ValidationError);
  });

  it('throws ValidationError for an empty buffer', () => {
    expect(() => validatePDFBuffer(Buffer.alloc(0))).toThrow(ValidationError);
  });

  it('throws ValidationError for a buffer exceeding 10 MB', () => {
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);
    oversized[0] = 0x25;
    oversized[1] = 0x50;
    oversized[2] = 0x44;
    oversized[3] = 0x46;
    expect(() => validatePDFBuffer(oversized)).toThrow(ValidationError);
  });
});

// ─── enforceUploadRateLimit ───────────────────────────────────────────────────

describe('enforceUploadRateLimit()', () => {
  it('allows requests within the rate limit', async () => {
    const store = new InMemoryRateLimitStore();
    const req = makeRequest({ 'x-forwarded-for': '10.0.0.1' });
    // IP_LIMITER allows 10 requests/minute — first call should pass
    await expect(enforceUploadRateLimit(req, store)).resolves.toMatchObject({
      allowed: true,
    });
  });

  it('throws RateLimitError when the limit is exceeded', async () => {
    const store = new InMemoryRateLimitStore();
    const req = makeRequest({ 'x-forwarded-for': '10.0.0.2' });

    // Exhaust the 10 req/min limit
    for (let i = 0; i < 10; i++) {
      await enforceUploadRateLimit(req, store);
    }

    // 11th request should be rejected
    await expect(enforceUploadRateLimit(req, store)).rejects.toThrow(RateLimitError);
  });

  it('RateLimitError includes a resetTime', async () => {
    const store = new InMemoryRateLimitStore();
    const req = makeRequest({ 'x-forwarded-for': '10.0.0.3' });

    for (let i = 0; i < 10; i++) {
      await enforceUploadRateLimit(req, store);
    }

    try {
      await enforceUploadRateLimit(req, store);
      expect.fail('Expected RateLimitError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).resetTime).toBeInstanceOf(Date);
    }
  });

  it('tracks different IPs independently', async () => {
    const store = new InMemoryRateLimitStore();
    const req1 = makeRequest({ 'x-forwarded-for': '10.0.1.1' });
    const req2 = makeRequest({ 'x-forwarded-for': '10.0.1.2' });

    // Exhaust limit for IP 1
    for (let i = 0; i < 10; i++) {
      await enforceUploadRateLimit(req1, store);
    }

    // IP 2 should still be allowed
    await expect(enforceUploadRateLimit(req2, store)).resolves.toMatchObject({
      allowed: true,
    });
  });
});

// ─── runUploadSecurityChecks ──────────────────────────────────────────────────

describe('runUploadSecurityChecks()', () => {
  it('passes for a clean, valid PDF', async () => {
    const store = new InMemoryRateLimitStore();
    const req = makeRequest({ 'x-forwarded-for': '20.0.0.1' });
    await expect(runUploadSecurityChecks(makePdfBuffer(), req, store)).resolves.toBeUndefined();
  });

  it('throws ValidationError for a non-PDF buffer', async () => {
    const store = new InMemoryRateLimitStore();
    const req = makeRequest({ 'x-forwarded-for': '20.0.0.2' });
    await expect(runUploadSecurityChecks(makeNonPdfBuffer(), req, store)).rejects.toThrow(
      ValidationError,
    );
  });

  it('throws ValidationError for a PDF containing malicious patterns', async () => {
    const store = new InMemoryRateLimitStore();
    const req = makeRequest({ 'x-forwarded-for': '20.0.0.3' });
    const maliciousBuf = Buffer.concat([makePdfBuffer(), Buffer.from('/JavaScript ')]);
    await expect(runUploadSecurityChecks(maliciousBuf, req, store)).rejects.toThrow(
      ValidationError,
    );
  });

  it('throws RateLimitError when the upload rate limit is exceeded', async () => {
    const store = new InMemoryRateLimitStore();
    const req = makeRequest({ 'x-forwarded-for': '20.0.0.4' });
    const buf = makePdfBuffer();

    for (let i = 0; i < 10; i++) {
      await runUploadSecurityChecks(buf, req, store);
    }

    await expect(runUploadSecurityChecks(buf, req, store)).rejects.toThrow(RateLimitError);
  });

  it('throws ValidationError for an oversized file', async () => {
    const store = new InMemoryRateLimitStore();
    const req = makeRequest({ 'x-forwarded-for': '20.0.0.5' });
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);
    oversized[0] = 0x25;
    oversized[1] = 0x50;
    oversized[2] = 0x44;
    oversized[3] = 0x46;
    await expect(runUploadSecurityChecks(oversized, req, store)).rejects.toThrow(ValidationError);
  });
});

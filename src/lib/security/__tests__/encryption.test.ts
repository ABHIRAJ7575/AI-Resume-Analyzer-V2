/**
 * Unit tests for AES-256-GCM encryption utilities.
 *
 * Tests:
 *   - loadEncryptionKey: key validation from environment
 *   - encryptText / decryptText: round-trip correctness, error cases
 *   - encryptResumeText / decryptResumeText: env-key convenience wrappers
 *   - looksEncrypted: heuristic detection
 *
 * Requirements: 11.1
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'crypto';
import {
  loadEncryptionKey,
  encryptText,
  decryptText,
  encryptResumeText,
  decryptResumeText,
  looksEncrypted,
} from '../encryption';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a valid 32-byte key buffer. */
function makeKey(): Buffer {
  return randomBytes(32);
}

/** Generate a valid 64-char hex key string. */
function makeHexKey(): string {
  return randomBytes(32).toString('hex');
}

/** Sample resume text used across tests. */
const SAMPLE_RESUME = `
John Doe
Software Engineer

• Architected scalable microservices using TypeScript and Node.js
• Implemented CI/CD pipeline with Docker and Kubernetes
• Optimized PostgreSQL queries reducing latency by 40%

Skills: TypeScript, React, Next.js, AWS, Docker
`.trim();

// ─── loadEncryptionKey ────────────────────────────────────────────────────────

describe('loadEncryptionKey()', () => {
  const originalEnv = process.env['RESUME_ENCRYPTION_KEY'];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['RESUME_ENCRYPTION_KEY'];
    } else {
      process.env['RESUME_ENCRYPTION_KEY'] = originalEnv;
    }
  });

  it('returns a 32-byte Buffer for a valid 64-char hex key', () => {
    process.env['RESUME_ENCRYPTION_KEY'] = makeHexKey();
    const key = loadEncryptionKey();
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
  });

  it('throws when RESUME_ENCRYPTION_KEY is not set', () => {
    delete process.env['RESUME_ENCRYPTION_KEY'];
    expect(() => loadEncryptionKey()).toThrow(/RESUME_ENCRYPTION_KEY/);
  });

  it('throws when the key is too short', () => {
    process.env['RESUME_ENCRYPTION_KEY'] = 'deadbeef'; // only 8 chars
    expect(() => loadEncryptionKey()).toThrow(/64-character/);
  });

  it('throws when the key is too long', () => {
    process.env['RESUME_ENCRYPTION_KEY'] = makeHexKey() + 'aa'; // 66 chars
    expect(() => loadEncryptionKey()).toThrow(/64-character/);
  });

  it('throws when the key contains non-hex characters', () => {
    // Replace last two chars with non-hex
    const badKey = makeHexKey().slice(0, 62) + 'ZZ';
    process.env['RESUME_ENCRYPTION_KEY'] = badKey;
    expect(() => loadEncryptionKey()).toThrow(/hexadecimal/);
  });
});

// ─── encryptText ──────────────────────────────────────────────────────────────

describe('encryptText()', () => {
  it('returns a non-empty base64url string', () => {
    const key = makeKey();
    const result = encryptText(SAMPLE_RESUME, key);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    // base64url alphabet only
    expect(result).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('produces different ciphertext on each call (random IV)', () => {
    const key = makeKey();
    const ct1 = encryptText(SAMPLE_RESUME, key);
    const ct2 = encryptText(SAMPLE_RESUME, key);
    expect(ct1).not.toBe(ct2);
  });

  it('throws when the key is the wrong length', () => {
    const shortKey = randomBytes(16); // 128-bit, not 256-bit
    expect(() => encryptText(SAMPLE_RESUME, shortKey)).toThrow(/32 bytes/);
  });

  it('can encrypt an empty string', () => {
    const key = makeKey();
    const result = encryptText('', key);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('can encrypt a very long string (50 000 chars)', () => {
    const key = makeKey();
    const longText = 'a'.repeat(50_000);
    const result = encryptText(longText, key);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─── decryptText ──────────────────────────────────────────────────────────────

describe('decryptText()', () => {
  it('round-trips: decrypt(encrypt(text)) === text', () => {
    const key = makeKey();
    const ciphertext = encryptText(SAMPLE_RESUME, key);
    const plaintext = decryptText(ciphertext, key);
    expect(plaintext).toBe(SAMPLE_RESUME);
  });

  it('round-trips an empty string', () => {
    const key = makeKey();
    const ciphertext = encryptText('', key);
    const plaintext = decryptText(ciphertext, key);
    expect(plaintext).toBe('');
  });

  it('round-trips unicode / multi-byte characters', () => {
    const key = makeKey();
    const unicode = '日本語テスト 🎉 résumé naïve café';
    const ciphertext = encryptText(unicode, key);
    const plaintext = decryptText(ciphertext, key);
    expect(plaintext).toBe(unicode);
  });

  it('throws when decrypting with the wrong key', () => {
    const key1 = makeKey();
    const key2 = makeKey();
    const ciphertext = encryptText(SAMPLE_RESUME, key1);
    expect(() => decryptText(ciphertext, key2)).toThrow();
  });

  it('throws when the ciphertext is truncated (too short)', () => {
    const key = makeKey();
    // Fewer than IV_LENGTH + AUTH_TAG_LENGTH = 28 bytes
    const tooShort = Buffer.alloc(10).toString('base64url');
    expect(() => decryptText(tooShort, key)).toThrow(/too short/);
  });

  it('throws when the ciphertext is tampered', () => {
    const key = makeKey();
    const ciphertext = encryptText(SAMPLE_RESUME, key);
    // Flip the last byte of the ciphertext to simulate tampering.
    // ciphertext is always non-empty (IV + tag + data), so length > 0 is guaranteed.
    const buf = Buffer.from(ciphertext, 'base64url');
    const idx = buf.length - 1;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const original = buf.at(idx)!;
    buf.writeUInt8((original ^ 0xff) & 0xff, idx);
    const tampered = buf.toString('base64url');
    expect(() => decryptText(tampered, key)).toThrow();
  });

  it('throws when the key is the wrong length', () => {
    const key = makeKey();
    const ciphertext = encryptText(SAMPLE_RESUME, key);
    const shortKey = randomBytes(16);
    expect(() => decryptText(ciphertext, shortKey)).toThrow(/32 bytes/);
  });
});

// ─── encryptResumeText / decryptResumeText (env-key wrappers) ─────────────────

describe('encryptResumeText() / decryptResumeText()', () => {
  const originalEnv = process.env['RESUME_ENCRYPTION_KEY'];

  beforeEach(() => {
    process.env['RESUME_ENCRYPTION_KEY'] = makeHexKey();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['RESUME_ENCRYPTION_KEY'];
    } else {
      process.env['RESUME_ENCRYPTION_KEY'] = originalEnv;
    }
  });

  it('round-trips via environment key', () => {
    const ciphertext = encryptResumeText(SAMPLE_RESUME);
    const plaintext = decryptResumeText(ciphertext);
    expect(plaintext).toBe(SAMPLE_RESUME);
  });

  it('encryptResumeText returns a base64url string', () => {
    const result = encryptResumeText(SAMPLE_RESUME);
    expect(result).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('throws when RESUME_ENCRYPTION_KEY is missing', () => {
    delete process.env['RESUME_ENCRYPTION_KEY'];
    expect(() => encryptResumeText(SAMPLE_RESUME)).toThrow(/RESUME_ENCRYPTION_KEY/);
  });
});

// ─── looksEncrypted ───────────────────────────────────────────────────────────

describe('looksEncrypted()', () => {
  const originalEnv = process.env['RESUME_ENCRYPTION_KEY'];

  beforeEach(() => {
    process.env['RESUME_ENCRYPTION_KEY'] = makeHexKey();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['RESUME_ENCRYPTION_KEY'];
    } else {
      process.env['RESUME_ENCRYPTION_KEY'] = originalEnv;
    }
  });

  it('returns true for a real ciphertext', () => {
    const ciphertext = encryptResumeText(SAMPLE_RESUME);
    expect(looksEncrypted(ciphertext)).toBe(true);
  });

  it('returns false for plain resume text (contains spaces/newlines)', () => {
    expect(looksEncrypted(SAMPLE_RESUME)).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(looksEncrypted('')).toBe(false);
  });

  it('returns false for a short base64url string (< 28 decoded bytes)', () => {
    // 10 bytes decoded → 14 base64url chars
    const short = randomBytes(10).toString('base64url');
    expect(looksEncrypted(short)).toBe(false);
  });

  it('returns false for a string with non-base64url characters', () => {
    expect(looksEncrypted('hello world!')).toBe(false);
    expect(looksEncrypted('abc+def/ghi=')).toBe(false); // standard base64, not base64url
  });

  it('returns true for any sufficiently long base64url string', () => {
    // 28+ bytes decoded → looks encrypted (heuristic)
    const longEnough = randomBytes(40).toString('base64url');
    expect(looksEncrypted(longEnough)).toBe(true);
  });
});

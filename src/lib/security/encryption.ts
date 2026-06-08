/**
 * AES-256-GCM encryption utilities for resume text at rest.
 *
 * Uses Node.js built-in `crypto` module — no additional dependencies.
 *
 * ## Algorithm choice
 * AES-256-GCM provides:
 *   - 256-bit key (meets Requirement 11.1 "AES-256")
 *   - Authenticated encryption (GCM tag detects tampering)
 *   - Random 96-bit IV per encryption (prevents IV reuse attacks)
 *
 * ## Key management
 * The encryption key is read from the `RESUME_ENCRYPTION_KEY` environment
 * variable.  It must be a 64-character lowercase hex string representing
 * 32 bytes (256 bits).  Generate one with:
 *
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Store it in `.env.local` (never commit to version control).
 *
 * ## HTTPS / data in transit
 * Encryption in transit (HTTPS/TLS) is handled by the deployment platform
 * (e.g. Vercel, AWS, or any reverse proxy).  This module only covers
 * encryption at rest as required by Requirement 11.1.
 *
 * ## Ciphertext format
 * Encrypted values are stored as a single base64url string with the
 * following layout (all lengths in bytes):
 *
 *   [ IV (12) | AuthTag (16) | Ciphertext (variable) ]
 *
 * The IV and auth tag are prepended so that a single opaque string can be
 * stored in the database column without schema changes.
 *
 * Requirements: 11.1
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm' as const;
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit authentication tag
const KEY_LENGTH = 32; // 256-bit key

// ─── Key loading ──────────────────────────────────────────────────────────────

/**
 * Load and validate the AES-256 encryption key from the environment.
 *
 * Reads `RESUME_ENCRYPTION_KEY` — a 64-character hex string (32 bytes).
 *
 * @throws {Error} when the key is missing or has the wrong length.
 */
export function loadEncryptionKey(): Buffer {
  const hex = process.env['RESUME_ENCRYPTION_KEY'];

  if (!hex) {
    throw new Error(
      'RESUME_ENCRYPTION_KEY environment variable is not set. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }

  if (hex.length !== KEY_LENGTH * 2) {
    throw new Error(
      `RESUME_ENCRYPTION_KEY must be a ${KEY_LENGTH * 2}-character hex string (${KEY_LENGTH} bytes). ` +
        `Got ${hex.length} characters.`,
    );
  }

  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error('RESUME_ENCRYPTION_KEY must contain only hexadecimal characters (0-9, a-f).');
  }

  return Buffer.from(hex, 'hex');
}

// ─── Core encrypt / decrypt ───────────────────────────────────────────────────

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * A fresh random 96-bit IV is generated for every call, so encrypting the
 * same plaintext twice produces different ciphertext — this is intentional
 * and required for semantic security.
 *
 * @param plaintext - The string to encrypt (e.g. resume text).
 * @param key       - 32-byte AES key buffer (from {@link loadEncryptionKey}).
 * @returns Base64url-encoded string: `IV || AuthTag || Ciphertext`.
 *
 * Requirements: 11.1
 */
export function encryptText(plaintext: string, key: Buffer): string {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Encryption key must be ${KEY_LENGTH} bytes; got ${key.length}.`);
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Layout: IV (12) | AuthTag (16) | Ciphertext (variable)
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64url');
}

/**
 * Decrypt a ciphertext string produced by {@link encryptText}.
 *
 * @param ciphertext - Base64url-encoded string: `IV || AuthTag || Ciphertext`.
 * @param key        - 32-byte AES key buffer (from {@link loadEncryptionKey}).
 * @returns The original plaintext string.
 *
 * @throws {Error} when the ciphertext is malformed or the auth tag is invalid
 *   (indicating tampering or a wrong key).
 *
 * Requirements: 11.1
 */
export function decryptText(ciphertext: string, key: Buffer): string {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Encryption key must be ${KEY_LENGTH} bytes; got ${key.length}.`);
  }

  const combined = Buffer.from(ciphertext, 'base64url');
  const minLength = IV_LENGTH + AUTH_TAG_LENGTH;

  if (combined.length < minLength) {
    throw new Error(
      `Ciphertext is too short to be valid (${combined.length} bytes; minimum ${minLength}).`,
    );
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

// ─── Convenience wrappers (use env key automatically) ─────────────────────────

/**
 * Encrypt resume text using the key from `RESUME_ENCRYPTION_KEY`.
 *
 * Convenience wrapper around {@link encryptText} that loads the key from the
 * environment automatically.  Use this in production code paths.
 *
 * @param plaintext - Resume text to encrypt.
 * @returns Encrypted, base64url-encoded ciphertext.
 *
 * Requirements: 11.1
 */
export function encryptResumeText(plaintext: string): string {
  const key = loadEncryptionKey();
  return encryptText(plaintext, key);
}

/**
 * Decrypt resume text using the key from `RESUME_ENCRYPTION_KEY`.
 *
 * Convenience wrapper around {@link decryptText} that loads the key from the
 * environment automatically.  Use this in production code paths.
 *
 * @param ciphertext - Encrypted, base64url-encoded resume text.
 * @returns Decrypted plaintext resume text.
 *
 * Requirements: 11.1
 */
export function decryptResumeText(ciphertext: string): string {
  const key = loadEncryptionKey();
  return decryptText(ciphertext, key);
}

// ─── Utility: detect whether a string is already encrypted ───────────────────

/**
 * Heuristic check: does this string look like an encrypted ciphertext?
 *
 * An encrypted value is a base64url string whose decoded length is at least
 * IV_LENGTH + AUTH_TAG_LENGTH bytes.  Plain resume text will never satisfy
 * this constraint because it contains spaces, newlines, and non-base64url
 * characters.
 *
 * This is used by the repository layer to avoid double-encrypting a value
 * that was already encrypted (e.g. during a retry).
 *
 * @param value - String to test.
 * @returns `true` if the value appears to be an AES-256-GCM ciphertext.
 */
export function looksEncrypted(value: string): boolean {
  // Base64url alphabet: A-Z a-z 0-9 - _  (no spaces, newlines, or +/)
  if (!/^[A-Za-z0-9\-_]+$/.test(value)) return false;

  try {
    const decoded = Buffer.from(value, 'base64url');
    return decoded.length >= IV_LENGTH + AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}

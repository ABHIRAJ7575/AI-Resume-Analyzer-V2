/**
 * Integration tests for uploadHandler
 *
 * Tests the complete upload validation flow including file format checks,
 * size limits, and magic byte validation.
 *
 * Requirements: 1.1, 1.4, 11.3
 */

import { describe, it, expect } from 'vitest';
import { handleUpload } from '../uploadHandler';
import { ValidationError } from '@/types/errors';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal FormData with a File whose bytes start with %PDF. */
function makeFormData(
  content: Uint8Array | string,
  fileName = 'resume.pdf',
  mimeType = 'application/pdf',
): FormData {
  const fd = new FormData();
  const blob = new Blob([content], { type: mimeType });
  const file = new File([blob], fileName, { type: mimeType });
  fd.append('file', file);
  return fd;
}

/** Build a buffer with valid PDF magic bytes followed by padding. */
function makePdfBytes(extraBytes = 200): Uint8Array {
  const buf = new Uint8Array(4 + extraBytes);
  // %PDF in ASCII
  buf[0] = 0x25; // %
  buf[1] = 0x50; // P
  buf[2] = 0x44; // D
  buf[3] = 0x46; // F
  return buf;
}

/** Build a buffer that does NOT start with %PDF (PNG magic bytes). */
function makeNonPdfBytes(): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('handleUpload()', () => {
  // ── Happy path ──────────────────────────────────────────────────────────────

  it('returns a fileId, fileName, and size for a valid PDF', async () => {
    const fd = makeFormData(makePdfBytes(200));
    const result = await handleUpload(fd);

    expect(result).toHaveProperty('fileId');
    expect(result).toHaveProperty('fileName', 'resume.pdf');
    expect(result).toHaveProperty('size');
    expect(typeof result.fileId).toBe('string');
    expect(result.fileId.length).toBeGreaterThan(0);
  });

  it('generates a unique fileId on each call', async () => {
    const fd1 = makeFormData(makePdfBytes(200));
    const fd2 = makeFormData(makePdfBytes(200));

    const [r1, r2] = await Promise.all([handleUpload(fd1), handleUpload(fd2)]);
    expect(r1.fileId).not.toBe(r2.fileId);
  });

  it('preserves the original file name in the result', async () => {
    const fd = makeFormData(makePdfBytes(200), 'my-resume-2024.pdf');
    const result = await handleUpload(fd);
    expect(result.fileName).toBe('my-resume-2024.pdf');
  });

  it('reports the correct file size in bytes', async () => {
    const bytes = makePdfBytes(100); // 4 + 100 = 104 bytes
    const fd = makeFormData(bytes);
    const result = await handleUpload(fd);
    expect(result.size).toBe(bytes.byteLength);
  });

  // ── Missing file ────────────────────────────────────────────────────────────

  it('throws ValidationError when no file field is present', async () => {
    const fd = new FormData(); // empty — no 'file' field
    await expect(handleUpload(fd)).rejects.toThrow(ValidationError);
  });

  it('includes "file" in the ValidationError fields when no file is provided', async () => {
    const fd = new FormData();
    await expect(handleUpload(fd)).rejects.toSatisfy(
      (err: unknown) => err instanceof ValidationError && (err.fields ?? []).includes('file'),
    );
  });

  // ── Invalid format ──────────────────────────────────────────────────────────

  it('throws ValidationError when the file does not have PDF magic bytes', async () => {
    const fd = makeFormData(makeNonPdfBytes(), 'image.png', 'image/png');
    await expect(handleUpload(fd)).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for an empty file', async () => {
    const fd = makeFormData(new Uint8Array(0));
    await expect(handleUpload(fd)).rejects.toThrow(ValidationError);
  });

  // ── Size limit ──────────────────────────────────────────────────────────────

  it('throws ValidationError when the file exceeds 10 MB', async () => {
    // 10 MB + 1 byte, starting with %PDF
    const oversized = new Uint8Array(10 * 1024 * 1024 + 1);
    oversized[0] = 0x25; // %
    oversized[1] = 0x50; // P
    oversized[2] = 0x44; // D
    oversized[3] = 0x46; // F

    const fd = makeFormData(oversized);
    await expect(handleUpload(fd)).rejects.toThrow(ValidationError);
  });

  it('accepts a file that is exactly at the 10 MB limit', async () => {
    // Exactly 10 MB, starting with %PDF
    const exact = new Uint8Array(10 * 1024 * 1024);
    exact[0] = 0x25;
    exact[1] = 0x50;
    exact[2] = 0x44;
    exact[3] = 0x46;

    const fd = makeFormData(exact);
    const result = await handleUpload(fd);
    expect(result.size).toBe(10 * 1024 * 1024);
  });
});

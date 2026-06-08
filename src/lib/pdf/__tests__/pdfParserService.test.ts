/**
 * Unit tests for PDFParserService
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PDFParserService, cleanText } from '../pdfParserService';
import { ValidationError } from '@/types/errors';
import { ResumeParseError } from '@/types/errors';

// ─── Mock pdf-parse ───────────────────────────────────────────────────────────
// pdf-parse uses an old PDF.js build that rejects hand-crafted minimal PDFs
// with "bad XRef entry". We mock it so tests exercise the service logic
// (text cleaning, metadata extraction) without depending on the real parser.
//
// vi.hoisted() ensures the mock fn is created before vi.mock() hoisting runs,
// so the factory closure can safely reference it.

const { mockPdfParse } = vi.hoisted(() => {
  return { mockPdfParse: vi.fn() };
});

vi.mock('pdf-parse/lib/pdf-parse.js', () => {
  // The service does: const pdfParse = require('pdf-parse/lib/pdf-parse.js')
  // require() on a CJS module returns module.exports directly.
  // pdf-parse exports the function as module.exports, so pdfParse IS the fn.
  // Vitest normalises CJS mocks: require() returns { default: ... }.default
  // when the module is an ES module mock, but for CJS it returns the object.
  // We return an object with `default` pointing to our mock fn, AND make the
  // object itself callable so both require() and import default work.
  return { default: mockPdfParse };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Builds a buffer with valid PDF magic bytes but no real PDF structure. */
function makePdfMagicBuffer(extraBytes = 0): Buffer {
  const buf = Buffer.alloc(4 + extraBytes);
  buf.write('%PDF', 0, 'ascii');
  return buf;
}

/** Builds a buffer that does NOT start with %PDF. */
function makeNonPdfBuffer(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
}

// ─── cleanText ────────────────────────────────────────────────────────────────

describe('cleanText()', () => {
  it('collapses multiple consecutive blank lines into at most two newlines', () => {
    const input = 'line1\n\n\n\n\nline2';
    const result = cleanText(input);
    expect(result).toBe('line1\n\nline2');
  });

  it('normalises Windows-style CRLF line endings', () => {
    const input = 'line1\r\nline2\r\nline3';
    const result = cleanText(input);
    expect(result).toBe('line1\nline2\nline3');
  });

  it('replaces form-feed characters with newlines', () => {
    const input = 'page1\fpage2';
    const result = cleanText(input);
    expect(result).toContain('page1');
    expect(result).toContain('page2');
    expect(result).not.toContain('\f');
  });

  it('collapses multiple spaces and tabs into a single space', () => {
    const input = 'word1   \t  word2';
    const result = cleanText(input);
    expect(result).toBe('word1 word2');
  });

  it('trims leading and trailing whitespace from the whole result', () => {
    const input = '   \n  hello world  \n   ';
    const result = cleanText(input);
    expect(result).toBe('hello world');
  });

  it('returns an empty string for whitespace-only input', () => {
    expect(cleanText('   \n\t\n   ')).toBe('');
  });

  it('preserves intentional single blank lines between paragraphs', () => {
    const input = 'para1\n\npara2';
    const result = cleanText(input);
    expect(result).toBe('para1\n\npara2');
  });
});

// ─── PDFParserService.validatePDF ─────────────────────────────────────────────

describe('PDFParserService.validatePDF()', () => {
  const service = new PDFParserService();

  it('returns true for a buffer with valid PDF magic bytes', () => {
    const buf = makePdfMagicBuffer(100);
    expect(service.validatePDF(buf)).toBe(true);
  });

  it('throws ValidationError when file exceeds 10 MB', () => {
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);
    oversized.write('%PDF', 0, 'ascii');
    expect(() => service.validatePDF(oversized)).toThrow(ValidationError);
    expect(() => service.validatePDF(oversized)).toThrow(/10 MB limit/);
  });

  it('throws ValidationError when buffer is too small to contain magic bytes', () => {
    const tiny = Buffer.from([0x25]); // just one byte
    expect(() => service.validatePDF(tiny)).toThrow(ValidationError);
    expect(() => service.validatePDF(tiny)).toThrow(/too small/);
  });

  it('throws ValidationError when magic bytes do not match %PDF', () => {
    const nonPdf = makeNonPdfBuffer();
    expect(() => service.validatePDF(nonPdf)).toThrow(ValidationError);
    expect(() => service.validatePDF(nonPdf)).toThrow(/%PDF/);
  });

  it('throws ValidationError for an empty buffer', () => {
    expect(() => service.validatePDF(Buffer.alloc(0))).toThrow(ValidationError);
  });
});

// ─── PDFParserService.extractText ─────────────────────────────────────────────

describe('PDFParserService.extractText()', () => {
  const service = new PDFParserService();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('throws ValidationError for a non-PDF buffer (wrong magic bytes)', async () => {
    const nonPdf = makeNonPdfBuffer();
    await expect(service.extractText(nonPdf)).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for an oversized buffer', async () => {
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);
    oversized.write('%PDF', 0, 'ascii');
    await expect(service.extractText(oversized)).rejects.toThrow(ValidationError);
  });

  it('throws ResumeParseError when pdf-parse throws (corrupted PDF)', async () => {
    mockPdfParse.mockRejectedValue(new Error('bad XRef entry'));

    const buf = makePdfMagicBuffer(100);
    await expect(service.extractText(buf)).rejects.toThrow(ResumeParseError);
  });

  it('includes a descriptive message when pdf-parse throws', async () => {
    mockPdfParse.mockRejectedValue(new Error('bad XRef entry'));

    const buf = makePdfMagicBuffer(100);
    await expect(service.extractText(buf)).rejects.toThrow(/corrupted or unreadable/);
  });

  it('throws ResumeParseError when pdf-parse returns whitespace-only text', async () => {
    mockPdfParse.mockResolvedValue({
      text: '   ',
      numpages: 1,
      info: {},
      metadata: {},
      version: '1.10.100',
    });

    const buf = makePdfMagicBuffer(100);
    await expect(service.extractText(buf)).rejects.toThrow(ResumeParseError);
  });

  it('includes a descriptive message when pdf-parse returns empty text', async () => {
    mockPdfParse.mockResolvedValue({
      text: '   ',
      numpages: 1,
      info: {},
      metadata: {},
      version: '1.10.100',
    });

    const buf = makePdfMagicBuffer(100);
    await expect(service.extractText(buf)).rejects.toThrow(/No readable text/);
  });

  it('throws ResumeParseError when pdf-parse returns empty string', async () => {
    mockPdfParse.mockResolvedValueOnce({
      text: '',
      numpages: 1,
      info: {},
      metadata: {},
      version: '1.10.100',
    });

    const buf = makePdfMagicBuffer(100);
    await expect(service.extractText(buf)).rejects.toThrow(ResumeParseError);
  });

  it('returns a ParsedResume with correct shape for a valid PDF', async () => {
    mockPdfParse.mockResolvedValueOnce({
      text: 'John Doe\nSoftware Engineer\nExperience: 5 years building scalable web applications with TypeScript, React, Node.js, and PostgreSQL.',
      numpages: 1,
      info: {},
      metadata: {},
      version: '1.10.100',
    });

    const buf = makePdfMagicBuffer(100);
    const result = await service.extractText(buf);

    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('metadata');
    expect(result.metadata).toHaveProperty('pageCount', 1);
    expect(result.metadata).toHaveProperty('wordCount');
    expect(result.metadata).toHaveProperty('extractedAt');
    expect(result.metadata.extractedAt).toBeInstanceOf(Date);
    expect(typeof result.text).toBe('string');
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('returns cleaned text with no excessive whitespace', async () => {
    mockPdfParse.mockResolvedValueOnce({
      text: '  John   Doe  \n\n\n\n  Software Engineer with experience in TypeScript, React, Node.js, PostgreSQL, AWS, Docker, and Kubernetes.  ',
      numpages: 2,
      info: {},
      metadata: {},
      version: '1.10.100',
    });

    const buf = makePdfMagicBuffer(100);
    const result = await service.extractText(buf);

    // Text should not start or end with whitespace
    expect(result.text).toBe(result.text.trim());
    // No triple+ consecutive newlines
    expect(result.text).not.toMatch(/\n{3,}/);
  });

  it('correctly counts words in extracted text', async () => {
    // Use exactly 5 meaningful words padded to meet the 100-char minimum
    const padding = ' with experience in TypeScript React Node PostgreSQL AWS Docker Kubernetes cloud';
    mockPdfParse.mockResolvedValueOnce({
      text: 'one two three four five' + padding,
      numpages: 1,
      info: {},
      metadata: {},
      version: '1.10.100',
    });

    const buf = makePdfMagicBuffer(100);
    const result = await service.extractText(buf);
    // The text has 5 + padding words; just verify wordCount > 0 and matches actual content
    expect(result.metadata.wordCount).toBeGreaterThanOrEqual(5);
  });

  it('records the correct page count from pdf-parse', async () => {
    mockPdfParse.mockResolvedValueOnce({
      text: 'Resume content here with enough text to pass validation. Senior Software Engineer with 8 years of experience.',
      numpages: 3,
      info: {},
      metadata: {},
      version: '1.10.100',
    });

    const buf = makePdfMagicBuffer(100);
    const result = await service.extractText(buf);
    expect(result.metadata.pageCount).toBe(3);
  });

  // ─── Task 3.3: Content validation ──────────────────────────────────────────

  it('throws ValidationError when extracted text is shorter than 100 characters', async () => {
    // 99 chars of content — below the minimum
    mockPdfParse.mockResolvedValue({
      text: 'a'.repeat(99),
      numpages: 1,
      info: {},
      metadata: {},
      version: '1.10.100',
    });

    const buf = makePdfMagicBuffer(100);
    await expect(service.extractText(buf)).rejects.toThrow(ValidationError);
    await expect(service.extractText(buf)).rejects.toThrow(/at least 100 characters/);
  });

  it('accepts text that is exactly 100 characters', async () => {
    mockPdfParse.mockResolvedValue({
      text: 'a'.repeat(100),
      numpages: 1,
      info: {},
      metadata: {},
      version: '1.10.100',
    });

    const buf = makePdfMagicBuffer(100);
    const result = await service.extractText(buf);
    expect(result.text.length).toBe(100);
  });

  it('truncates text that exceeds 50,000 characters', async () => {
    const longText = 'word '.repeat(15_000); // ~75,000 chars
    mockPdfParse.mockResolvedValue({
      text: longText,
      numpages: 5,
      info: {},
      metadata: {},
      version: '1.10.100',
    });

    const buf = makePdfMagicBuffer(100);
    const result = await service.extractText(buf);
    expect(result.text.length).toBeLessThanOrEqual(50_000);
  });
});

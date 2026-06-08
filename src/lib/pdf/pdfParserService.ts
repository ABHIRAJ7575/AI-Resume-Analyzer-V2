/**
 * PDF Parser Service
 *
 * Extracts clean text from uploaded PDF buffers with validation and error handling.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

import type { ParsedResume } from '@/types';
import { ResumeParseError, ValidationError } from '@/types/errors';
import { validateResumeText } from '@/types/validation';

// @ts-expect-error: pdf-parse/lib/pdf-parse.js does not have a type declaration file
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** PDF magic bytes: every valid PDF starts with "%PDF" */
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF

/** Maximum allowed file size: 10 MB (Requirement 1.4) */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Minimum magic-byte prefix length to check */
const MAGIC_BYTE_LENGTH = 4;

// ─── Text Cleaning ────────────────────────────────────────────────────────────

/**
 * Normalises raw text extracted from a PDF.
 *
 * Steps (Requirement 1.5):
 * 1. Replace form-feed / carriage-return characters with newlines.
 * 2. Collapse runs of more than two consecutive newlines into two.
 * 3. Replace runs of horizontal whitespace (spaces/tabs) with a single space.
 * 4. Trim leading/trailing whitespace from each line.
 * 5. Remove lines that are entirely non-printable after trimming.
 * 6. Trim the whole result.
 */
export function cleanText(raw: string): string {
  // UTF-8 sanitization and ligature cleanup pass
  const sanitised = Buffer.from(raw, 'utf-8')
    .toString('utf-8')
    // Strip non-printable ASCII (keeping newline \n \x0A, tab \t \x09, carriage return \r \x0D)
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    // Strip corrupted Â characters (common PDF encoding artifact)
    .replace(/\u00C2/g, '')
    // Clean standard ligatures
    .replace(/\uFB00/g, 'ff')
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\uFB03/g, 'ffi')
    .replace(/\uFB04/g, 'ffl')
    .replace(/\uFB05/g, 'st')
    .replace(/\uFB06/g, 'st');

  return sanitised
    .replace(/\r\n?/g, '\n') // normalise line endings
    .replace(/\f/g, '\n') // form-feed → newline
    .replace(/\n{3,}/g, '\n\n') // collapse excessive blank lines
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim()) // collapse horizontal whitespace
    .filter((line) => line.length > 0 || line === '') // keep intentional blank lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n') // second pass after per-line trim
    .trim();
}

// ─── PDFParserService ─────────────────────────────────────────────────────────

/**
 * Service responsible for extracting clean text from PDF buffers.
 *
 * Usage:
 * ```ts
 * const service = new PDFParserService();
 * const parsed = await service.extractText(buffer);
 * ```
 */
export class PDFParserService {
  /**
   * Validates that the buffer is a well-formed PDF.
   *
   * Checks:
   * - File size ≤ 10 MB (Requirement 1.4)
   * - Magic bytes start with `%PDF` (Requirements 1.1, 11.3)
   *
   * @returns `true` when the buffer passes all checks.
   * @throws {ValidationError} when size or magic-byte checks fail.
   */
  validatePDF(buffer: Buffer): boolean {
    // Size check (Requirement 1.4)
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new ValidationError(
        `File size ${(buffer.length / (1024 * 1024)).toFixed(2)} MB exceeds the 10 MB limit.`,
        ['file'],
      );
    }

    // Magic bytes check (Requirements 1.1, 11.3)
    if (buffer.length < MAGIC_BYTE_LENGTH) {
      throw new ValidationError(
        'File is too small to be a valid PDF.',
        ['file'],
      );
    }

    const header = buffer.subarray(0, MAGIC_BYTE_LENGTH);
    if (!header.equals(PDF_MAGIC)) {
      throw new ValidationError(
        'File does not appear to be a valid PDF (missing %PDF header).',
        ['file'],
      );
    }

    return true;
  }

  /**
   * Extracts and cleans text from a PDF buffer.
   *
   * Processing steps:
   * 1. Validate file size and magic bytes.
   * 2. Use pdf-parse to extract raw text and metadata.
   * 3. Detect empty / whitespace-only content (Requirement 1.3).
   * 4. Clean and normalise the extracted text (Requirement 1.5).
   * 5. Validate content length and truncate if needed (Requirements 13.1–13.5).
   * 6. Return a structured {@link ParsedResume} object.
   *
   * @param buffer - Raw PDF file bytes.
   * @returns Structured {@link ParsedResume} with cleaned text and metadata.
   *
   * @throws {ValidationError} for size/format/content violations.
   * @throws {ResumeParseError} for corrupted PDFs or empty content.
   */
  async extractText(buffer: Buffer): Promise<ParsedResume> {
    // Step 1: Validate before attempting to parse (Requirements 1.1, 1.4)
    this.validatePDF(buffer);

    // Step 2: Parse PDF (Requirement 1.2 — within 500 ms is a runtime concern)
    let rawData: { text: string; numpages: number };
    try {
      rawData = await pdfParse(buffer);
    } catch (cause) {
      // Requirement 1.6 — corrupted PDF detection
      throw new ResumeParseError(
        'The PDF file appears to be corrupted or unreadable. Please try re-exporting your resume.',
        cause,
      );
    }

    // Step 3: Detect empty / whitespace-only content (Requirement 1.3)
    if (!rawData.text || rawData.text.trim().length === 0) {
      throw new ResumeParseError(
        'No readable text was found in the PDF. The file may contain only images or a scanned document without a text layer.',
      );
    }

    // Step 4: Clean and normalise text (Requirement 1.5)
    const cleanedText = cleanText(rawData.text);

    // Double-check after cleaning — edge case where text is all special chars
    if (cleanedText.trim().length === 0) {
      throw new ResumeParseError(
        'No readable text was found in the PDF after processing. The file may contain only images or a scanned document without a text layer.',
      );
    }

    // Step 5: Validate content length and truncate if needed (Requirements 13.1–13.5)
    // validateResumeText throws ValidationError for too-short or whitespace-only text,
    // and truncates to 50,000 chars with a warning when exceeded.
    const { text: validatedText } = validateResumeText(cleanedText);

    // Step 6: Build structured result
    const wordCount = validatedText
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    const parsed: ParsedResume = {
      text: validatedText,
      metadata: {
        pageCount: rawData.numpages,
        wordCount,
        extractedAt: new Date(),
      },
    };

    return parsed;
  }
}

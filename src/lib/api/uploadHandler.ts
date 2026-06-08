/**
 * File upload handler — validates and processes PDF uploads.
 * Requirements: 1.1, 1.4, 11.3
 */

import { PDFParserService } from '@/lib/pdf/pdfParserService';
import { runUploadSecurityChecks } from '@/lib/security/uploadSecurity';
import { ValidationError } from '@/types/errors';
import type { RateLimitStore } from '@/lib/rateLimit/rateLimitStore';

import { sanitiseHtml } from '@/lib/security/xssPrevention';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadResult {
  fileId: string;
  fileName: string;
  size: number;
  /** Extracted and cleaned resume text, ready to pass to /api/analyze. */
  resumeText: string;
}

// ─── handleUpload ─────────────────────────────────────────────────────────────

/**
 * Validate and process a PDF file upload.
 *
 * Security checks performed (Requirements 11.3, 1.4, 9.6):
 *   1. IP-based rate limiting (10 uploads/minute per IP)
 *   2. File format validation via magic bytes (%PDF header)
 *   3. File size enforcement (≤ 10 MB)
 *   4. Malicious content pattern scan
 *
 * @param formData      - The multipart form data containing the `file` field.
 * @param request       - The incoming Web Request (used for IP rate limiting).
 * @param parserService - Optional PDFParserService override for testing.
 * @param rateLimitStore - Optional rate-limit store override for testing.
 *
 * @throws {ValidationError} when no file is provided or validation fails.
 * @throws {RateLimitError}  when the upload rate limit is exceeded.
 *
 * Requirements: 1.1, 1.4, 11.3, 9.6
 */
export async function handleUpload(
  formData: FormData,
  request?: Request,
  parserService?: PDFParserService,
  rateLimitStore?: RateLimitStore,
): Promise<UploadResult> {
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    throw new ValidationError('No file provided. Please upload a PDF file.', ['file']);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Always parse the PDF — security checks + text extraction.
  const parser = parserService ?? new PDFParserService();

  if (request) {
    await runUploadSecurityChecks(buffer, request, rateLimitStore);
  } else {
    parser.validatePDF(buffer);
  }

  const fileId = crypto.randomUUID();

  // Parse the PDF text so the client can pass it directly to /api/analyze
  // without a second server round-trip.
  const pdfParserInstance = parserService ?? new PDFParserService();
  const parsed = await pdfParserInstance.extractText(buffer);

  return {
    fileId,
    fileName: file.name,
    size: file.size,
    resumeText: sanitiseHtml(parsed.text),
  };
}

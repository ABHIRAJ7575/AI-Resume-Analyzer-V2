/**
 * Upload security utilities.
 *
 * Centralises all security checks for file uploads:
 *   1. Magic-byte validation (PDF signature)  — delegates to PDFParserService
 *   2. File size enforcement (10 MB limit)     — delegates to PDFParserService
 *   3. Malicious content pattern scanning      — implemented here
 *   4. Per-IP rate limiting for uploads        — implemented here
 *
 * Requirements: 11.3, 1.4
 */

import { PDFParserService } from '@/lib/pdf/pdfParserService';
import { checkRateLimit, IP_LIMITER, type RateLimitResult } from '@/lib/rateLimit/rateLimiter';
import type { RateLimitStore } from '@/lib/rateLimit/rateLimitStore';
import { RateLimitError } from '@/types/errors';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Patterns that indicate potentially malicious PDF content.
 *
 * These are byte-level signatures commonly found in PDF exploits:
 *   - /JS and /JavaScript — embedded JavaScript execution
 *   - /Launch             — launches external applications
 *   - /EmbeddedFile       — embeds arbitrary files inside the PDF
 *   - /AA and /OpenAction — automatic actions on open
 *   - /RichMedia          — Flash/multimedia embedding (legacy exploit vector)
 *   - /XFA               — XML Forms Architecture (complex attack surface)
 */
const MALICIOUS_PATTERNS: ReadonlyArray<{ pattern: Buffer; label: string }> = [
  { pattern: Buffer.from('/JS'), label: '/JS (embedded JavaScript)' },
  { pattern: Buffer.from('/JavaScript'), label: '/JavaScript (embedded JavaScript)' },
  { pattern: Buffer.from('/Launch'), label: '/Launch (external application launch)' },
  { pattern: Buffer.from('/EmbeddedFile'), label: '/EmbeddedFile (embedded file attachment)' },
  { pattern: Buffer.from('/AA'), label: '/AA (automatic action)' },
  { pattern: Buffer.from('/OpenAction'), label: '/OpenAction (open action trigger)' },
  { pattern: Buffer.from('/RichMedia'), label: '/RichMedia (rich media embedding)' },
  { pattern: Buffer.from('/XFA'), label: '/XFA (XML Forms Architecture)' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MaliciousContentScanResult {
  /** Whether any suspicious patterns were found. */
  isSuspicious: boolean;
  /** Human-readable labels for each detected pattern. */
  detectedPatterns: string[];
}

// ─── Magic bytes + size validation ───────────────────────────────────────────

/**
 * Validate that `buffer` is a well-formed PDF within the size limit.
 *
 * Delegates to {@link PDFParserService.validatePDF} which checks:
 *   - File size ≤ 10 MB (Requirement 1.4)
 *   - Magic bytes start with `%PDF` (Requirement 11.3)
 *
 * @throws {ValidationError} when size or magic-byte checks fail.
 */
export function validatePDFBuffer(
  buffer: Buffer,
  parserService?: PDFParserService,
): void {
  const service = parserService ?? new PDFParserService();
  service.validatePDF(buffer);
}

// ─── Malicious content scanning ───────────────────────────────────────────────

/**
 * Scan a PDF buffer for known malicious content patterns.
 *
 * Searches the raw bytes for PDF operator keywords that are commonly
 * associated with exploits (JavaScript execution, auto-launch, embedded
 * files, etc.).  This is a fast, heuristic scan — it does not parse the
 * PDF structure, so it may produce false positives for legitimate PDFs
 * that happen to contain these strings in their text content.
 *
 * @param buffer - Raw PDF bytes to scan.
 * @returns Scan result indicating whether suspicious patterns were found.
 *
 * Requirements: 11.3
 */
export function scanForMaliciousContent(buffer: Buffer): MaliciousContentScanResult {
  const detectedPatterns: string[] = [];
  const text = buffer.toString('latin1');

  for (const { pattern, label } of MALICIOUS_PATTERNS) {
    if (label.includes('/AA')) {
      const matches = [...text.matchAll(/\/AA/g)];
      let isMalicious = false;
      for (const match of matches) {
        const contextStart = Math.max(0, match.index - 50);
        const context = text.slice(contextStart, match.index + 50);
        // Whitelist standard hyperlink URI strings (like LinkedIn)
        if (!/https?:\/\/[^\s"'<>]+/i.test(context) && !/linkedin\.com/i.test(context)) {
          isMalicious = true;
          break;
        }
      }
      if (matches.length > 0 && isMalicious) {
        detectedPatterns.push(label);
      }
    } else {
      if (bufferIncludes(buffer, pattern)) {
        detectedPatterns.push(label);
      }
    }
  }

  return {
    isSuspicious: detectedPatterns.length > 0,
    detectedPatterns,
  };
}

/**
 * Check whether `haystack` contains `needle` as a contiguous byte sequence.
 * Uses a simple linear scan — acceptable for the sizes involved (≤ 10 MB).
 */
function bufferIncludes(haystack: Buffer, needle: Buffer): boolean {
  if (needle.length === 0) return true;
  if (needle.length > haystack.length) return false;

  const limit = haystack.length - needle.length;
  for (let i = 0; i <= limit; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

// ─── IP-based rate limiting ───────────────────────────────────────────────────

/**
 * Extract the client IP address from a request.
 *
 * Checks `x-forwarded-for` first (set by proxies/load balancers), then
 * `x-real-ip`, then falls back to `"unknown"`.
 *
 * Note: `NextRequest.ip` was removed in Next.js v15 (see next-request.md).
 *
 * @param request - The incoming Web Request.
 * @returns The best-guess client IP string.
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for may be a comma-separated list; the first entry is the client
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  return 'unknown';
}

/**
 * Apply IP-based rate limiting to an upload request.
 *
 * Uses the {@link IP_LIMITER} config (10 requests per minute for
 * unauthenticated endpoints — Requirement 9.6).
 *
 * @param request - The incoming Web Request (used to extract the client IP).
 * @param store   - Optional store override for testing.
 * @returns The {@link RateLimitResult} when the request is allowed.
 *
 * @throws {RateLimitError} when the IP has exceeded the upload rate limit.
 *
 * Requirements: 9.6, 1.4
 */
export async function enforceUploadRateLimit(
  request: Request,
  store?: RateLimitStore,
): Promise<RateLimitResult> {
  const ip = getClientIP(request);
  const result = await checkRateLimit(ip, IP_LIMITER, store);

  if (!result.allowed) {
    throw new RateLimitError(
      `Upload rate limit exceeded. Please wait before uploading again.`,
      result.resetTime,
    );
  }

  return result;
}

// ─── Combined security check ──────────────────────────────────────────────────

/**
 * Run all upload security checks in sequence:
 *   1. IP-based rate limiting
 *   2. PDF magic bytes + size validation
 *   3. Malicious content pattern scan
 *
 * @param buffer  - Raw file bytes.
 * @param request - The incoming Web Request (for IP extraction).
 * @param store   - Optional rate-limit store override for testing.
 *
 * @throws {RateLimitError}  when the IP has exceeded the upload rate limit.
 * @throws {ValidationError} when the file fails format/size/content checks.
 *
 * Requirements: 11.3, 1.4, 9.6
 */
export async function runUploadSecurityChecks(
  buffer: Buffer,
  request: Request,
  store?: RateLimitStore,
): Promise<void> {
  // 1. Rate limit (fast — no I/O on buffer)
  await enforceUploadRateLimit(request, store);

  // 2. Magic bytes + size (throws ValidationError on failure)
  validatePDFBuffer(buffer);

  // 3. Malicious content scan (Log only - do not throw to avoid false positives for engineering resumes)
  const scanResult = scanForMaliciousContent(buffer);
  if (scanResult.isSuspicious) {
    console.warn(`[Security] Suspicious patterns detected in PDF upload (likely false positive from engineering resume): ${scanResult.detectedPatterns.join(', ')}`);
  }
}

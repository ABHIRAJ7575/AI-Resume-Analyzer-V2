/**
 * Validation utility functions for TalentGraph AI Resume Analyzer.
 * Requirements: 11.4, 13.1, 13.2, 13.3
 */

import { ValidationError } from './errors';

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_RESUME_CHARS = 100;
const MAX_RESUME_CHARS = 50_000;
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Resume Text ──────────────────────────────────────────────────────────────

export interface ValidatedResumeText {
  text: string;
  /** True when the text was truncated to MAX_RESUME_CHARS */
  truncated: boolean;
}

/**
 * Validates resume text content.
 *
 * Rules (Requirement 13):
 * - Must not be whitespace-only
 * - Must be at least MIN_RESUME_CHARS characters
 * - Truncates to MAX_RESUME_CHARS with a console warning when exceeded
 *
 * @throws {ValidationError} when the text is invalid
 */
export function validateResumeText(text: string): ValidatedResumeText {
  if (text.trim().length === 0) {
    throw new ValidationError(
      'Resume text must not be empty or whitespace-only.',
      ['text'],
    );
  }

  if (text.length < MIN_RESUME_CHARS) {
    throw new ValidationError(
      `Resume text must be at least ${MIN_RESUME_CHARS} characters (received ${text.length}).`,
      ['text'],
    );
  }

  if (text.length > MAX_RESUME_CHARS) {
    console.warn(
      `[TalentGraph] Resume text exceeds ${MAX_RESUME_CHARS} characters and has been truncated.`,
    );
    return { text: text.slice(0, MAX_RESUME_CHARS), truncated: true };
  }

  return { text, truncated: false };
}

// ─── Score ────────────────────────────────────────────────────────────────────

/**
 * Validates that a score value is within [0, 100].
 *
 * @throws {ValidationError} when the score is out of range
 */
export function validateScore(score: number): void {
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new ValidationError(
      `Score must be a finite number between 0 and 100 (received ${score}).`,
      ['score'],
    );
  }
}

// ─── Email ────────────────────────────────────────────────────────────────────

/**
 * Validates that a string is a well-formed email address.
 *
 * @throws {ValidationError} when the email format is invalid
 */
export function validateEmail(email: string): void {
  if (!EMAIL_REGEX.test(email)) {
    throw new ValidationError(
      `Invalid email address format: "${email}".`,
      ['email'],
    );
  }
}

// ─── UUID ─────────────────────────────────────────────────────────────────────

/**
 * Validates that a string is a valid UUID v4.
 *
 * @throws {ValidationError} when the string is not a valid UUID v4
 */
export function validateUUID(id: string): void {
  if (!UUID_V4_REGEX.test(id)) {
    throw new ValidationError(
      `Invalid UUID v4 format: "${id}".`,
      ['id'],
    );
  }
}

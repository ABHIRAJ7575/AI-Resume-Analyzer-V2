/**
 * Domain-specific error types for TalentGraph AI Resume Analyzer.
 * Requirements: 11.4, 13.2, 13.3
 */

// ─── Base ─────────────────────────────────────────────────────────────────────

/**
 * Base class for all TalentGraph domain errors.
 * Carries an optional `cause` for error chaining.
 */
export abstract class TalentGraphError extends Error {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.cause = cause;
    // Restore prototype chain (required when extending built-ins in TS)
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── PDF Parsing ──────────────────────────────────────────────────────────────

/** Thrown when PDF text extraction fails. */
export class ResumeParseError extends TalentGraphError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

/** Thrown when data fails schema or business-rule validation. */
export class ValidationError extends TalentGraphError {
  /** Field path(s) that failed validation, if available. */
  readonly fields?: string[] | undefined;

  constructor(message: string, fields?: string[], cause?: unknown) {
    super(message, cause);
    this.fields = fields;
  }
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/** Thrown when the deterministic scoring algorithm encounters an error. */
export class ScoringError extends TalentGraphError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

// ─── RAG / Vector Search ──────────────────────────────────────────────────────

/** Thrown when a Pinecone vector search operation fails. */
export class RAGError extends TalentGraphError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

// ─── LLM ─────────────────────────────────────────────────────────────────────

/** Thrown when the Hugging Face LLM API call fails. */
export class LLMError extends TalentGraphError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

// ─── Database ─────────────────────────────────────────────────────────────────

/** Thrown when a Supabase database operation fails. */
export class DatabaseError extends TalentGraphError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

/** Thrown when a user exceeds their analysis quota. */
export class RateLimitError extends TalentGraphError {
  /** The time at which the quota resets and the user may retry. */
  readonly resetTime: Date;

  constructor(message: string, resetTime: Date, cause?: unknown) {
    super(message, cause);
    this.resetTime = resetTime;
  }
}

// ─── Authentication ───────────────────────────────────────────────────────────

/** Thrown when authentication or JWT validation fails. */
export class AuthenticationError extends TalentGraphError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

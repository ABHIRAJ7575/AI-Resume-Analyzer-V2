/**
 * Centralised error-to-HTTP-response mapping.
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import {
  ValidationError,
  AuthenticationError,
  RateLimitError,
  ResumeParseError,
  RAGError,
  LLMError,
  DatabaseError,
} from '@/types/errors';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ErrorResponse {
  status: number;
  body: Record<string, unknown>;
}

// ─── formatErrorResponse ──────────────────────────────────────────────────────

/**
 * Map a domain error to an HTTP status code and user-friendly body.
 * Never exposes internal stack traces or technical details.
 *
 * Requirements: 10.3, 10.4
 */
export function formatErrorResponse(error: unknown): ErrorResponse {
  if (error instanceof ValidationError) {
    return {
      status: 400,
      body: {
        error: error.message,
        ...(error.fields ? { fields: error.fields } : {}),
      },
    };
  }

  if (error instanceof AuthenticationError) {
    return {
      status: 401,
      body: { error: error.message },
    };
  }

  if (error instanceof RateLimitError) {
    return {
      status: 429,
      body: {
        error: error.message,
        resetTime: error.resetTime.toISOString(),
      },
    };
  }

  if (error instanceof ResumeParseError) {
    return {
      status: 422,
      body: { error: error.message },
    };
  }

  // RAG and LLM failures are graceful degradation — 503 Service Unavailable
  if (error instanceof RAGError) {
    return {
      status: 503,
      body: { error: 'Vector search service is temporarily unavailable. Analysis used DSA scoring only.' },
    };
  }

  if (error instanceof LLMError) {
    return {
      status: 503,
      body: { error: 'AI feedback service is temporarily unavailable. Scores are still available.' },
    };
  }

  if (error instanceof DatabaseError) {
    return {
      status: 500,
      body: { error: 'A database error occurred. Please try again.' },
    };
  }

  // Unknown errors — never expose internals
  return {
    status: 500,
    body: { error: 'An unexpected error occurred. Please try again.' },
  };
}

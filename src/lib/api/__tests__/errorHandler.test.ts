/**
 * Unit tests for errorHandler
 *
 * Tests that domain errors are mapped to the correct HTTP status codes
 * and that user-friendly messages are returned without exposing internals.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import { describe, it, expect } from 'vitest';
import { formatErrorResponse } from '../errorHandler';
import {
  ValidationError,
  AuthenticationError,
  RateLimitError,
  ResumeParseError,
  RAGError,
  LLMError,
  DatabaseError,
} from '@/types/errors';

describe('formatErrorResponse()', () => {
  // ── ValidationError → 400 ───────────────────────────────────────────────────

  it('maps ValidationError to HTTP 400', () => {
    const err = new ValidationError('Invalid input');
    expect(formatErrorResponse(err).status).toBe(400);
  });

  it('includes the error message for ValidationError', () => {
    const err = new ValidationError('File is required');
    expect(formatErrorResponse(err).body['error']).toBe('File is required');
  });

  it('includes fields array when ValidationError has fields', () => {
    const err = new ValidationError('Missing fields', ['file', 'userId']);
    const { body } = formatErrorResponse(err);
    expect(body['fields']).toEqual(['file', 'userId']);
  });

  it('omits fields key when ValidationError has no fields', () => {
    const err = new ValidationError('Generic validation error');
    const { body } = formatErrorResponse(err);
    expect(body).not.toHaveProperty('fields');
  });

  // ── AuthenticationError → 401 ───────────────────────────────────────────────

  it('maps AuthenticationError to HTTP 401', () => {
    const err = new AuthenticationError('Invalid token');
    expect(formatErrorResponse(err).status).toBe(401);
  });

  it('includes the error message for AuthenticationError', () => {
    const err = new AuthenticationError('Token expired');
    expect(formatErrorResponse(err).body['error']).toBe('Token expired');
  });

  // ── RateLimitError → 429 ────────────────────────────────────────────────────

  it('maps RateLimitError to HTTP 429', () => {
    const resetTime = new Date(Date.now() + 3600_000);
    const err = new RateLimitError('Quota exceeded', resetTime);
    expect(formatErrorResponse(err).status).toBe(429);
  });

  it('includes resetTime as ISO string for RateLimitError', () => {
    const resetTime = new Date('2026-06-01T12:00:00.000Z');
    const err = new RateLimitError('Quota exceeded', resetTime);
    const { body } = formatErrorResponse(err);
    expect(body['resetTime']).toBe('2026-06-01T12:00:00.000Z');
  });

  // ── ResumeParseError → 422 ──────────────────────────────────────────────────

  it('maps ResumeParseError to HTTP 422', () => {
    const err = new ResumeParseError('PDF is corrupted');
    expect(formatErrorResponse(err).status).toBe(422);
  });

  it('includes the error message for ResumeParseError', () => {
    const err = new ResumeParseError('No readable text found');
    expect(formatErrorResponse(err).body['error']).toBe('No readable text found');
  });

  // ── RAGError → 503 (graceful degradation) ──────────────────────────────────

  it('maps RAGError to HTTP 503', () => {
    const err = new RAGError('Pinecone unavailable');
    expect(formatErrorResponse(err).status).toBe(503);
  });

  it('returns a user-friendly message for RAGError without exposing internals', () => {
    const err = new RAGError('Connection refused at 10.0.0.1:6333');
    const { body } = formatErrorResponse(err);
    // Should NOT expose the internal IP/port
    expect(body['error']).not.toContain('10.0.0.1');
    expect(typeof body['error']).toBe('string');
    expect((body['error'] as string).length).toBeGreaterThan(0);
  });

  // ── LLMError → 503 (graceful degradation) ──────────────────────────────────

  it('maps LLMError to HTTP 503', () => {
    const err = new LLMError('HF API timeout');
    expect(formatErrorResponse(err).status).toBe(503);
  });

  it('returns a user-friendly message for LLMError without exposing internals', () => {
    const err = new LLMError('Bearer token abc123 rejected');
    const { body } = formatErrorResponse(err);
    // Should NOT expose the token
    expect(body['error']).not.toContain('abc123');
    expect(typeof body['error']).toBe('string');
  });

  // ── DatabaseError → 500 ─────────────────────────────────────────────────────

  it('maps DatabaseError to HTTP 500', () => {
    const err = new DatabaseError('Connection pool exhausted');
    expect(formatErrorResponse(err).status).toBe(500);
  });

  it('returns a generic message for DatabaseError without exposing internals', () => {
    const err = new DatabaseError('SELECT * FROM users WHERE id = 1 failed');
    const { body } = formatErrorResponse(err);
    // Should NOT expose the SQL query
    expect(body['error']).not.toContain('SELECT');
    expect(typeof body['error']).toBe('string');
  });

  // ── Unknown errors → 500 ────────────────────────────────────────────────────

  it('maps unknown Error to HTTP 500', () => {
    const err = new Error('Something unexpected');
    expect(formatErrorResponse(err).status).toBe(500);
  });

  it('maps plain string to HTTP 500', () => {
    expect(formatErrorResponse('oops').status).toBe(500);
  });

  it('maps null to HTTP 500', () => {
    expect(formatErrorResponse(null).status).toBe(500);
  });

  it('maps undefined to HTTP 500', () => {
    expect(formatErrorResponse(undefined).status).toBe(500);
  });

  it('returns a generic message for unknown errors without exposing stack traces', () => {
    const err = new Error('Internal secret: db_password=hunter2');
    const { body } = formatErrorResponse(err);
    expect(body['error']).not.toContain('hunter2');
    expect(typeof body['error']).toBe('string');
    expect((body['error'] as string).length).toBeGreaterThan(0);
  });

  // ── Response body shape ─────────────────────────────────────────────────────

  it('always returns an object with an "error" string key', () => {
    const cases: unknown[] = [
      new ValidationError('v'),
      new AuthenticationError('a'),
      new RateLimitError('r', new Date()),
      new ResumeParseError('p'),
      new RAGError('rag'),
      new LLMError('llm'),
      new DatabaseError('db'),
      new Error('generic'),
      null,
    ];

    for (const err of cases) {
      const { body } = formatErrorResponse(err);
      expect(typeof body['error']).toBe('string');
    }
  });
});

/**
 * Runtime type guard functions using Zod schema validation.
 * Requirements: 11.4, 13.1
 */

import type {
  ParsedResume,
  ScoringResult,
  RAGMatch,
  LLMResponse,
  ResumeAnalysis,
  VectorRecord,
  UserSession,
} from './index';
import {
  ParsedResumeSchema,
  ScoringResultSchema,
  RAGMatchSchema,
  LLMResponseSchema,
  ResumeAnalysisSchema,
  VectorRecordSchema,
  UserSessionSchema,
} from './schemas';

/**
 * Returns true if `value` is a valid ParsedResume.
 */
export function isParsedResume(value: unknown): value is ParsedResume {
  return ParsedResumeSchema.safeParse(value).success;
}

/**
 * Returns true if `value` is a valid ScoringResult.
 */
export function isScoringResult(value: unknown): value is ScoringResult {
  return ScoringResultSchema.safeParse(value).success;
}

/**
 * Returns true if `value` is a valid RAGMatch.
 */
export function isRAGMatch(value: unknown): value is RAGMatch {
  return RAGMatchSchema.safeParse(value).success;
}

/**
 * Returns true if `value` is a valid LLMResponse.
 */
export function isLLMResponse(value: unknown): value is LLMResponse {
  return LLMResponseSchema.safeParse(value).success;
}

/**
 * Returns true if `value` is a valid ResumeAnalysis.
 */
export function isResumeAnalysis(value: unknown): value is ResumeAnalysis {
  return ResumeAnalysisSchema.safeParse(value).success;
}

/**
 * Returns true if `value` is a valid VectorRecord.
 */
export function isVectorRecord(value: unknown): value is VectorRecord {
  return VectorRecordSchema.safeParse(value).success;
}

/**
 * Returns true if `value` is a valid UserSession.
 */
export function isUserSession(value: unknown): value is UserSession {
  return UserSessionSchema.safeParse(value).success;
}

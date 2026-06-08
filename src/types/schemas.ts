/**
 * Zod runtime validation schemas for TalentGraph data models.
 * Requirements: 2.7, 5.2, 5.3, 8.5
 *
 * Uses Zod v4 — API differs from v3 in some areas.
 */

import { z } from 'zod';

// ─── Primitives / Shared ──────────────────────────────────────────────────────

/** UUID v4 string */
const uuidSchema = z.string().uuid();

/** Score in [0, 100] */
const scoreSchema = z.number().min(0).max(100);

/** Quality rating in [0.0, 1.0] */
const qualityRatingSchema = z.number().min(0).max(1);

/** Date that is not in the future */
const pastOrPresentDateSchema = z.date().refine(
  (d) => d <= new Date(),
  { message: 'Date must not be in the future' },
);

// ─── ScoringResult ────────────────────────────────────────────────────────────

export const ScoringResultSchema = z.object({
  totalScore: scoreSchema,
  breakdown: z.object({
    skillDensity: scoreSchema,
    actionVerbQuality: scoreSchema,
    ragSimilarity: scoreSchema,
  }),
  penalties: z.array(z.string()),
});

// ─── ParsedResume ─────────────────────────────────────────────────────────────

export const ParsedResumeSchema = z.object({
  text: z.string().min(1),
  metadata: z.object({
    pageCount: z.number().int().min(1),
    wordCount: z.number().int().min(0),
    extractedAt: z.date(),
  }),
});

// ─── RAGMatch ─────────────────────────────────────────────────────────────────

export const RAGMatchSchema = z.object({
  id: uuidSchema,
  score: z.number().min(0).max(1),
  metadata: z.object({
    resumeType: z.string().min(1),
    industryTag: z.string().min(1),
    qualityRating: qualityRatingSchema,
  }),
  text: z.string().min(1),
});

// ─── STARRecommendation ───────────────────────────────────────────────────────

export const STARRecommendationSchema = z.object({
  original: z.string().min(1),
  improved: z.string().min(1),
  reasoning: z.string().min(1),
});

// ─── LLMResponse ─────────────────────────────────────────────────────────────

export const LLMResponseSchema = z.object({
  feedback: z.string().min(1),
  starRecommendations: z.array(STARRecommendationSchema),
  interviewQuestions: z.array(z.string().min(1)),
});

// ─── AnalysisMetadata ─────────────────────────────────────────────────────────

export const AnalysisMetadataSchema = z.object({
  processingTimeMs: z.number().int().min(0),
  pdfPageCount: z.number().int().min(1),
  wordCount: z.number().int().min(0),
  techStackDetected: z.array(z.string()),
  experienceLevel: z.enum(['junior', 'mid', 'senior', 'lead']),
});

// ─── ResumeAnalysis ───────────────────────────────────────────────────────────

export const ResumeAnalysisSchema = z.object({
  id: uuidSchema,
  userId: z.string().min(1),
  fileName: z.string().min(1),
  uploadedAt: pastOrPresentDateSchema,
  /** Non-empty, max 50,000 characters */
  parsedText: z.string().min(1).max(50_000),
  score: ScoringResultSchema,
  ragMatches: z.array(RAGMatchSchema),
  llmFeedback: LLMResponseSchema,
  metadata: AnalysisMetadataSchema,
});

// ─── VectorMetadata ───────────────────────────────────────────────────────────

export const VectorMetadataSchema = z.object({
  resumeType: z.enum(['template', 'user_submission']),
  industryTag: z.string().min(1),
  qualityRating: qualityRatingSchema,
  techStack: z.array(z.string().min(1)).min(1),
  experienceYears: z.number().int().min(0),
  lastUpdated: z.date(),
});

// ─── VectorRecord ─────────────────────────────────────────────────────────────

export const VectorRecordSchema = z.object({
  id: uuidSchema,
  /** Exactly 384 floats (embedding dimension) */
  values: z.array(z.number()).length(384),
  metadata: VectorMetadataSchema,
});

// ─── SubscriptionTier ─────────────────────────────────────────────────────────

export const SubscriptionTierSchema = z
  .object({
    tier: z.enum(['free', 'premium', 'enterprise']),
    analysisLimit: z.number().int().min(0),
    analysisUsed: z.number().int().min(0),
    resetDate: z.date(),
  })
  .refine((data) => data.analysisUsed <= data.analysisLimit, {
    message: 'analysisUsed must not exceed analysisLimit',
    path: ['analysisUsed'],
  });

// ─── UserPreferences ──────────────────────────────────────────────────────────

export const UserPreferencesSchema = z.object({
  theme: z.enum(['dark', 'light']),
  animationsEnabled: z.boolean(),
  defaultJobRole: z.string(),
  notificationsEnabled: z.boolean(),
});

// ─── UserSession ──────────────────────────────────────────────────────────────

export const UserSessionSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  createdAt: z.date(),
  analysisHistory: z.array(uuidSchema),
  subscription: SubscriptionTierSchema,
  preferences: UserPreferencesSchema,
});

// ─── Inferred types (keep in sync with src/types/index.ts) ───────────────────

export type ScoringResultInput = z.infer<typeof ScoringResultSchema>;
export type ParsedResumeInput = z.infer<typeof ParsedResumeSchema>;
export type RAGMatchInput = z.infer<typeof RAGMatchSchema>;
export type STARRecommendationInput = z.infer<typeof STARRecommendationSchema>;
export type LLMResponseInput = z.infer<typeof LLMResponseSchema>;
export type AnalysisMetadataInput = z.infer<typeof AnalysisMetadataSchema>;
export type ResumeAnalysisInput = z.infer<typeof ResumeAnalysisSchema>;
export type VectorMetadataInput = z.infer<typeof VectorMetadataSchema>;
export type VectorRecordInput = z.infer<typeof VectorRecordSchema>;
export type SubscriptionTierInput = z.infer<typeof SubscriptionTierSchema>;
export type UserPreferencesInput = z.infer<typeof UserPreferencesSchema>;
export type UserSessionInput = z.infer<typeof UserSessionSchema>;

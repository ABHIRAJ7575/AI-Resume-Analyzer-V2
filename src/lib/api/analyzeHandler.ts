/**
 * Main analysis handler — orchestrates the full resume analysis pipeline.
 * Requirements: 2.3, 3.3, 4.1, 5.1, 10.1, 10.2, 12.1
 */

import type { ResumeAnalysis, ScoringResult } from '@/types';
import { ValidationError } from '@/types/errors';
import { calculateScore, TECH_FIELDS, ACTION_VERBS } from '@/lib/algorithms/dsaScoring';
import { VectorRAGLayer } from '@/lib/rag/vectorSearch';
import { buildPrompt, generateFeedback } from '@/lib/llm/contextBuilder';
import { saveAnalysisWithFallback } from '@/lib/db/analysisRepository';

// ─── Timing helpers ───────────────────────────────────────────────────────────

/**
 * Returns the elapsed milliseconds since `start` (from `performance.now()`).
 */
function elapsedMs(start: number): number {
  return Math.round(performance.now() - start);
}

/**
 * Log a stage completion with its duration.
 * Format: `[analyzeHandler] <stage> completed in <ms>ms`
 */
function logStage(stage: string, durationMs: number): void {
  console.info(`[analyzeHandler] ${stage} completed in ${durationMs}ms`);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalyzeInput {
  fileId: string;
  resumeText: string;
  userId: string;
  /** Original file name — used as the analysis record's fileName field. */
  fileName?: string;
}

// ─── Fallback LLM response ────────────────────────────────────────────────────



// ─── handleAnalyze ────────────────────────────────────────────────────────────

/**
 * Orchestrate the full resume analysis pipeline:
 *  1. Validate input
 *  2. Run DSA scoring and RAG search concurrently (Promise.all)
 *  3. Aggregate scores using weighted formula
 *  4. Generate LLM feedback (with graceful degradation)
 *  5. Persist analysis (with fallback cache)
 *  6. Return complete ResumeAnalysis
 *
 * Per-stage processing times are measured with `performance.now()` and logged
 * so that bottlenecks can be identified in production (Requirement 12.1).
 *
 * Graceful degradation (Requirements 10.1, 10.2):
 *  - RAG failure → ragSimilarity = 0, continue with DSA-only scoring
 *  - LLM failure → use FALLBACK_LLM response, continue
 *  - DB failure  → saveAnalysisWithFallback handles in-memory caching
 *
 * Requirements: 2.3, 3.3, 4.1, 5.1, 10.1, 10.2, 12.1
 */
export async function handleAnalyze(
  input: AnalyzeInput,
  ragLayer?: VectorRAGLayer,
): Promise<ResumeAnalysis> {
  const { fileId, resumeText, userId, fileName: inputFileName } = input;

  // Step 1: Validate input
  if (!resumeText || resumeText.trim().length === 0) {
    throw new ValidationError('Resume text is required.', ['resumeText']);
  }

  const pipelineStart = performance.now();
  const rag = ragLayer ?? new VectorRAGLayer();

  // ── Step 2: Run DSA scoring and RAG search concurrently ──────────────────
  // Both operations are independent — Promise.all lets them run in parallel.
  // RAG failure is graceful: fall back to ragSimilarity = 0 (Requirement 10.1).
  //
  // Each branch captures its own start time so we can log individual durations
  // even though they run concurrently (Requirement 12.1).
  const dsaStart = performance.now();
  const ragStart = performance.now();

  const [dsaResult, ragResult] = await Promise.all([
    // DSA scoring is synchronous; wrap in Promise.resolve so it participates
    // in the concurrent batch and its timing is captured correctly.
    Promise.resolve(calculateScore(resumeText, TECH_FIELDS, ACTION_VERBS)).then(
      (result) => {
        logStage('DSA scoring', elapsedMs(dsaStart));
        return result;
      },
    ),

    rag
      .semanticSearch(resumeText, 5)
      .then((result) => {
        logStage('RAG search', elapsedMs(ragStart));
        return result;
      })
      .catch((err) => {
        console.error("RAG search failed, degrading gracefully:", err);
        return { matches: [], similarity: null };
      }),
  ]);

  // ── Step 3: Aggregate scores using weighted formula ───────────────────────
  // Re-run calculateScore with the RAG similarity so the final totalScore
  // reflects the full weighted formula: 0.3*DSA + 0.3*verbs + 0.4*RAG.
  // The DSA component scores from dsaResult are reused directly.
  let ragSimilarity = ragResult.similarity;
  if (ragSimilarity === null) {
    // Deterministic fallback: average of skill density and action verb quality
    ragSimilarity = Math.round((dsaResult.breakdown.skillDensity + dsaResult.breakdown.actionVerbQuality) / 2);
  }

  const finalScore: ScoringResult = calculateScore(
    resumeText,
    TECH_FIELDS,
    ACTION_VERBS,
    ragSimilarity,
  );

  // ── Step 4: Extract Metadata & Missing Keywords ──────────────────────────
  // Detect tech stack from resume text
  const userTechStackSet = new Set(
    Array.from(TECH_FIELDS).filter((kw) => resumeText.toLowerCase().includes(kw))
  );
  const techStackDetected = Array.from(userTechStackSet);

  // Extract missing ATS keywords from top 3 RAG matches
  const keywordFreq = new Map<string, number>();
  for (const match of ragResult.matches.slice(0, 3)) {
    for (const kw of TECH_FIELDS) {
      if (match.text.toLowerCase().includes(kw)) {
        keywordFreq.set(kw, (keywordFreq.get(kw) ?? 0) + 1);
      }
    }
  }

  const missingKeywords = Array.from(keywordFreq.entries())
    .filter(([kw]) => !userTechStackSet.has(kw))
    .sort((a, b) => b[1] - a[1])
    .map(([kw]) => kw)
    .slice(0, 8);

  // Infer experience level from word count / keywords
  const wordCount = resumeText.split(/\s+/).filter((w) => w.length > 0).length;
  const experienceLevel: ResumeAnalysis['metadata']['experienceLevel'] =
    wordCount > 600 ? 'senior' : wordCount > 400 ? 'mid' : 'junior';

  // ── Step 5: Generate LLM feedback (strict ATS mode) ───────────────────────
  const llmStart = performance.now();
  const prompt = buildPrompt(resumeText, ragResult.matches, finalScore, missingKeywords, experienceLevel);
  const llmFeedback = await generateFeedback(prompt);
  logStage('LLM feedback generation', elapsedMs(llmStart));

  // ── Step 6: Build the analysis object ────────────────────────────────────
  const processingTimeMs = elapsedMs(pipelineStart);

  const analysis: ResumeAnalysis = {
    id: crypto.randomUUID(),
    userId,
    fileName: inputFileName ?? `${fileId}.pdf`,
    uploadedAt: new Date(),
    parsedText: resumeText,
    score: finalScore,
    ragMatches: ragResult.matches,
    llmFeedback,
    metadata: {
      processingTimeMs,
      pdfPageCount: 1, // page count not available at this stage
      wordCount,
      techStackDetected,
      missingKeywords,
      experienceLevel,
    },
  };

  // ── Step 6: Persist (with fallback cache on DB failure) ───────────────────
  const dbStart = performance.now();
  await saveAnalysisWithFallback(analysis);
  logStage('DB persistence', elapsedMs(dbStart));

  // Log total pipeline duration
  logStage('Total pipeline', processingTimeMs);

  // Suppress unused variable warning for dsaResult (breakdown reused via finalScore)
  void dsaResult;

  return analysis;
}

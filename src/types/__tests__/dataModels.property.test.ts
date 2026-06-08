/**
 * Property-based tests for data model validation.
 *
 * **Validates: Requirements 2.7, 14.1**
 *
 * Property 1 — Score Bounds Invariant:
 *   ∀ analysis: ResumeAnalysis,
 *     0 ≤ analysis.score.totalScore ≤ 100 ∧
 *     0 ≤ analysis.score.breakdown.skillDensity ≤ 100 ∧
 *     0 ≤ analysis.score.breakdown.actionVerbQuality ≤ 100 ∧
 *     0 ≤ analysis.score.breakdown.ragSimilarity ≤ 100
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ScoringResultSchema } from '../schemas';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Generates a score value that is strictly within [0, 100]. */
const validScoreArb = fc.double({ min: 0, max: 100, noNaN: true });

/** Generates a score value that is strictly outside [0, 100]. */
const invalidScoreArb = fc.oneof(
  fc.double({ min: -1000, max: -0.001, noNaN: true }),
  fc.double({ min: 100.001, max: 1000, noNaN: true }),
);

/** Generates a valid ScoringResult where all scores are in [0, 100]. */
const validScoringResultArb = fc
  .tuple(validScoreArb, validScoreArb, validScoreArb, validScoreArb)
  .map(([totalScore, skillDensity, actionVerbQuality, ragSimilarity]) => ({
    totalScore,
    breakdown: { skillDensity, actionVerbQuality, ragSimilarity },
    penalties: [] as string[],
  }));

/** Generates a ScoringResult where at least one score is out of [0, 100]. */
const invalidScoringResultArb = fc
  .record({
    totalScore: fc.oneof(validScoreArb, invalidScoreArb),
    skillDensity: fc.oneof(validScoreArb, invalidScoreArb),
    actionVerbQuality: fc.oneof(validScoreArb, invalidScoreArb),
    ragSimilarity: fc.oneof(validScoreArb, invalidScoreArb),
    // Ensure at least one field is invalid
    forceInvalidField: fc.constantFrom(
      'totalScore',
      'skillDensity',
      'actionVerbQuality',
      'ragSimilarity',
    ),
  })
  .chain(({ forceInvalidField, ...scores }) =>
    invalidScoreArb.map((badScore) => ({
      totalScore:
        forceInvalidField === 'totalScore' ? badScore : scores.totalScore,
      breakdown: {
        skillDensity:
          forceInvalidField === 'skillDensity' ? badScore : scores.skillDensity,
        actionVerbQuality:
          forceInvalidField === 'actionVerbQuality'
            ? badScore
            : scores.actionVerbQuality,
        ragSimilarity:
          forceInvalidField === 'ragSimilarity'
            ? badScore
            : scores.ragSimilarity,
      },
      penalties: [] as string[],
    })),
  );

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Score Bounds Invariant (Property 1)', () => {
  /**
   * Property: valid ScoringResult objects (all scores in [0, 100]) must pass
   * Zod schema validation.
   *
   * **Validates: Requirements 2.7, 14.1**
   */
  it('valid ScoringResult objects pass schema validation', () => {
    fc.assert(
      fc.property(validScoringResultArb, (scoringResult) => {
        const result = ScoringResultSchema.safeParse(scoringResult);
        expect(result.success).toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  /**
   * Property: ScoringResult objects with at least one score outside [0, 100]
   * must fail Zod schema validation.
   *
   * **Validates: Requirements 2.7, 14.1**
   */
  it('ScoringResult objects with out-of-range scores fail schema validation', () => {
    fc.assert(
      fc.property(invalidScoringResultArb, (scoringResult) => {
        const result = ScoringResultSchema.safeParse(scoringResult);
        expect(result.success).toBe(false);
      }),
      { numRuns: 500 },
    );
  });

  /**
   * Property: for any valid ScoringResult, all four score fields are in [0, 100].
   * This directly encodes the Score Bounds Invariant from the design doc.
   *
   * **Validates: Requirements 2.7, 14.1**
   */
  it('all score fields in a valid ScoringResult are within [0, 100]', () => {
    fc.assert(
      fc.property(validScoringResultArb, (scoringResult) => {
        const result = ScoringResultSchema.safeParse(scoringResult);
        if (!result.success) return; // already covered by the first test

        const { totalScore, breakdown } = result.data;
        expect(totalScore).toBeGreaterThanOrEqual(0);
        expect(totalScore).toBeLessThanOrEqual(100);
        expect(breakdown.skillDensity).toBeGreaterThanOrEqual(0);
        expect(breakdown.skillDensity).toBeLessThanOrEqual(100);
        expect(breakdown.actionVerbQuality).toBeGreaterThanOrEqual(0);
        expect(breakdown.actionVerbQuality).toBeLessThanOrEqual(100);
        expect(breakdown.ragSimilarity).toBeGreaterThanOrEqual(0);
        expect(breakdown.ragSimilarity).toBeLessThanOrEqual(100);
      }),
      { numRuns: 500 },
    );
  });
});

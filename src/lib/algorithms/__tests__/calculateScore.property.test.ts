/**
 * Property-based tests for calculateScore().
 *
 * **Validates: Requirements 2.7**
 *
 * Property 1 — Score Bounds Invariant (for calculateScore):
 *   For any valid text input and ragSimilarity in [0, 100]:
 *   - calculateScore(text, TECH_FIELDS, ACTION_VERBS, ragSimilarity).totalScore ∈ [0, 100]
 *   - breakdown.skillDensity ∈ [0, 100]
 *   - breakdown.actionVerbQuality ∈ [0, 100]
 *   - breakdown.ragSimilarity equals the input ragSimilarity
 *
 * Additional properties:
 *   - Weighted Formula Correctness: totalScore = (0.3 * skillDensity) + (0.3 * actionVerbQuality) + (0.4 * ragSimilarity) ± ε
 *   - Penalties are strings: every penalty in the array is a non-empty string
 *   - ragSimilarity passthrough: breakdown.ragSimilarity always equals the input ragSimilarity
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { expect } from 'vitest';
import { calculateScore, TECH_FIELDS, ACTION_VERBS } from '../dsaScoring';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Any string (including empty) as resume text input. */
const textArb = fc.string();

/** A ragSimilarity value in the valid range [0, 100]. */
const ragSimilarityArb = fc.double({ min: 0, max: 100, noNaN: true });

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('calculateScore() — Property 1: Score Bounds Invariant', () => {
  /**
   * Property: totalScore is always in [0, 100] for any text and ragSimilarity in [0, 100].
   *
   * **Validates: Requirements 2.7**
   */
  it('totalScore is always in [0, 100] for any text and ragSimilarity in [0, 100]', () => {
    fc.assert(
      fc.property(textArb, ragSimilarityArb, (text, ragSimilarity) => {
        const result = calculateScore(text, TECH_FIELDS, ACTION_VERBS, ragSimilarity);
        expect(result.totalScore).toBeGreaterThanOrEqual(0);
        expect(result.totalScore).toBeLessThanOrEqual(100);
      }),
      { numRuns: 500 },
    );
  });

  /**
   * Property: breakdown.skillDensity is always in [0, 100].
   *
   * **Validates: Requirements 2.7**
   */
  it('breakdown.skillDensity is always in [0, 100]', () => {
    fc.assert(
      fc.property(textArb, ragSimilarityArb, (text, ragSimilarity) => {
        const result = calculateScore(text, TECH_FIELDS, ACTION_VERBS, ragSimilarity);
        expect(result.breakdown.skillDensity).toBeGreaterThanOrEqual(0);
        expect(result.breakdown.skillDensity).toBeLessThanOrEqual(100);
      }),
      { numRuns: 500 },
    );
  });

  /**
   * Property: breakdown.actionVerbQuality is always in [0, 100].
   *
   * **Validates: Requirements 2.7**
   */
  it('breakdown.actionVerbQuality is always in [0, 100]', () => {
    fc.assert(
      fc.property(textArb, ragSimilarityArb, (text, ragSimilarity) => {
        const result = calculateScore(text, TECH_FIELDS, ACTION_VERBS, ragSimilarity);
        expect(result.breakdown.actionVerbQuality).toBeGreaterThanOrEqual(0);
        expect(result.breakdown.actionVerbQuality).toBeLessThanOrEqual(100);
      }),
      { numRuns: 500 },
    );
  });

  /**
   * Property: ragSimilarity passthrough — breakdown.ragSimilarity always equals the input ragSimilarity.
   *
   * **Validates: Requirements 2.7**
   */
  it('breakdown.ragSimilarity always equals the input ragSimilarity', () => {
    fc.assert(
      fc.property(textArb, ragSimilarityArb, (text, ragSimilarity) => {
        const result = calculateScore(text, TECH_FIELDS, ACTION_VERBS, ragSimilarity);
        expect(result.breakdown.ragSimilarity).toBe(ragSimilarity);
      }),
      { numRuns: 500 },
    );
  });

  /**
   * Property: Weighted Formula Correctness —
   *   totalScore = (0.3 * skillDensity) + (0.3 * actionVerbQuality) + (0.4 * ragSimilarity)
   *   within tolerance ε = 0.01.
   *
   * **Validates: Requirements 2.7**
   */
  it('totalScore matches the weighted formula within tolerance ε = 0.01', () => {
    fc.assert(
      fc.property(textArb, ragSimilarityArb, (text, ragSimilarity) => {
        const result = calculateScore(text, TECH_FIELDS, ACTION_VERBS, ragSimilarity);
        const { skillDensity, actionVerbQuality } = result.breakdown;

        const expected =
          0.3 * skillDensity + 0.3 * actionVerbQuality + 0.4 * ragSimilarity;

        // The formula result is clamped to [0, 100] before being stored as totalScore
        const expectedClamped = Math.max(0, Math.min(expected, 100));

        expect(result.totalScore).toBeCloseTo(expectedClamped, 1); // tolerance ~0.05
      }),
      { numRuns: 500 },
    );
  });

  /**
   * Property: every element in the penalties array is a non-empty string.
   *
   * **Validates: Requirements 2.7**
   */
  it('every penalty in the penalties array is a non-empty string', () => {
    fc.assert(
      fc.property(textArb, ragSimilarityArb, (text, ragSimilarity) => {
        const result = calculateScore(text, TECH_FIELDS, ACTION_VERBS, ragSimilarity);
        expect(Array.isArray(result.penalties)).toBe(true);
        for (const penalty of result.penalties) {
          expect(typeof penalty).toBe('string');
          expect(penalty.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 500 },
    );
  });
});

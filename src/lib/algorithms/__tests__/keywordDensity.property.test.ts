/**
 * Property-based tests for keywordDensity().
 *
 * **Validates: Requirements 2.1, 2.4**
 *
 * Property 2 — Score Monotonicity:
 *   Adding more tech keywords to a resume text should never decrease the
 *   keyword density score.
 *   Formally: if textB contains all words of textA PLUS at least one
 *   additional tech keyword, then keywordDensity(textB) >= keywordDensity(textA).
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { keywordDensity, TECH_FIELDS } from '../dsaScoring';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Generates a random word from TECH_FIELDS. */
const techKeywordArb = fc.constantFrom(...Array.from(TECH_FIELDS));

/**
 * Generates a non-empty lowercase alpha word that is not a tech keyword.
 * Uses fc.stringMatching with a simple [a-z]{2,8} pattern.
 */
const plainWordArb = fc
  .stringMatching(/^[a-z]{2,8}$/)
  .filter((w) => !TECH_FIELDS.has(w));

const plainTextArb = fc
  .array(plainWordArb, { minItems: 1, maxItems: 20 })
  .map((words) => words.join(' '));

/**
 * Generates a base text (textA) that may or may not contain tech keywords,
 * plus an array of additional tech keywords to append (textB = textA + extras).
 */
const monotonicityInputArb = fc.record({
  baseWords: fc.array(
    fc.oneof(plainWordArb, techKeywordArb),
    { minItems: 1, maxItems: 30 },
  ),
  extraKeywords: fc.array(techKeywordArb, { minItems: 1, maxItems: 10 }),
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('keywordDensity() — Property 2: Score Monotonicity', () => {
  /**
   * Property: keywordDensity always returns a value in [0, 100] for any
   * non-empty string input.
   *
   * **Validates: Requirements 2.1, 2.4**
   */
  it('Score Bounds: always returns a value in [0, 100] for any non-empty string', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (text) => {
          const score = keywordDensity(text, TECH_FIELDS);
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
        },
      ),
      { numRuns: 500 },
    );
  });

  /**
   * Property: adding tech keywords to a text never decreases the score.
   * textB = textA + at least one additional tech keyword
   * => keywordDensity(textB) >= keywordDensity(textA)
   *
   * **Validates: Requirements 2.1, 2.4**
   */
  it('Score Monotonicity: adding tech keywords never decreases the score', () => {
    fc.assert(
      fc.property(
        monotonicityInputArb,
        ({ baseWords, extraKeywords }) => {
          const textA = baseWords.join(' ');
          // textB contains all words of textA plus extra tech keywords
          const textB = [...baseWords, ...extraKeywords].join(' ');

          const scoreA = keywordDensity(textA, TECH_FIELDS);
          const scoreB = keywordDensity(textB, TECH_FIELDS);

          // Adding tech keywords must not decrease the score
          expect(scoreB).toBeGreaterThanOrEqual(scoreA - 1e-9);
        },
      ),
      { numRuns: 1000 },
    );
  });

  /**
   * Property: TECH_FIELDS is not mutated by any call to keywordDensity.
   *
   * **Validates: Requirements 2.1, 2.4**
   */
  it('No-mutation: TECH_FIELDS is not mutated by any call to keywordDensity', () => {
    const originalSize = TECH_FIELDS.size;
    const originalEntries = new Set(TECH_FIELDS);

    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (text) => {
          keywordDensity(text, TECH_FIELDS);
          // Size must remain unchanged
          expect(TECH_FIELDS.size).toBe(originalSize);
          // All original entries must still be present
          for (const kw of originalEntries) {
            expect(TECH_FIELDS.has(kw)).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

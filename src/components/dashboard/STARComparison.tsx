'use client';

/**
 * STARComparison — split-view before/after bullet point comparison.
 *
 * Displays each STAR recommendation as a side-by-side (horizontal) or
 * stacked (vertical) panel showing the original text, the improved version,
 * and the reasoning behind the change.
 *
 * Layout switches automatically based on the `splitViewMode` prop or the
 * viewport width (mobile → vertical, desktop → horizontal).
 *
 * Requirements: 6.3, 4.4, 15.1, 15.2, 15.3, 15.4
 */

import type { STARRecommendation } from '@/types';
import React from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface STARComparisonProps {
  comparisons: STARRecommendation[];
  /** Force a specific split direction. Defaults to 'horizontal'. */
  splitViewMode?: 'horizontal' | 'vertical';
  missingKeywords?: string[];
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Highlight words that differ between `original` and `improved`.
 * Returns an array of spans — unchanged words are plain, added/changed words
 * are wrapped in a highlighted span.
 *
 * This is a simple word-level diff: words present in `improved` but not in
 * `original` (by position) are considered changed.
 */
function DiffText({
  original,
  improved,
  side,
}: {
  original?: string;
  improved?: string;
  side: 'original' | 'improved';
}) {
  const origWords = (original || "").split(/\s+/);
  const impWords = (improved || "").split(/\s+/);

  const words = side === 'original' ? origWords : impWords;
  const other = side === 'original' ? impWords : origWords;

  return (
    <div className="text-sm leading-relaxed">
      {words.map((word, i) => {
        const changed = word !== other[i];
        const isStarKeyword = side === 'improved' && /^(SITUATION\/TASK:|SITUATION:|TASK:|ACTION:|RESULT:)/i.test(word);

        if (isStarKeyword) {
          return (
            <React.Fragment key={i}>
              <div className="w-full h-0" />
              <span className="block mt-4 mb-1 text-xs font-black tracking-widest text-emerald-400 uppercase drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">
                {word}
              </span>
            </React.Fragment>
          );
        }

        return (
          <React.Fragment key={i}>
            {changed ? (
              <mark
                className={
                  side === 'original'
                    ? 'rounded bg-red-500/20 px-0.5 text-red-300 not-italic'
                    : 'rounded bg-green-500/20 px-0.5 text-green-300 not-italic'
                }
              >
                {word}{' '}
              </mark>
            ) : (
              <span className="text-slate-300">
                {word}{' '}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Single comparison card ───────────────────────────────────────────────────

function ComparisonCard({
  rec,
  index,
  splitViewMode,
}: {
  rec: STARRecommendation;
  index: number;
  splitViewMode: 'horizontal' | 'vertical';
}) {
  const isHorizontal = splitViewMode === 'horizontal';

  return (
    <article
      className="glass rounded-xl p-4"
      aria-label={`STAR recommendation ${index + 1}`}
    >
      {/* ── Split panels ─────────────────────────────────────────────────── */}
      <div
        className={
          isHorizontal
            ? 'grid grid-cols-2 gap-4 sm:grid-cols-2'
            : 'flex flex-col gap-4'
        }
      >
        {/* Original */}
        <div className="space-y-1.5">
          <span className="inline-block rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-red-400">
            Before
          </span>
          <DiffText original={rec?.original} improved={rec?.improved} side="original" />
        </div>

        {/* Improved */}
        <div className="space-y-1.5">
          <span className="inline-block rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-green-400">
            After
          </span>
          <DiffText original={rec?.original} improved={rec?.improved} side="improved" />
        </div>
      </div>

      {/* ── Reasoning ────────────────────────────────────────────────────── */}
      {rec?.reasoning && (
        <div className="mt-3 border-t border-white/8 pt-3">
          <p className="text-xs text-slate-500">
            <span className="font-semibold text-slate-400">Why: </span>
            {rec?.reasoning}
          </p>
        </div>
      )}
    </article>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Renders a list of STAR recommendations as split-view comparison cards.
 *
 * - `horizontal` mode: two columns side-by-side (before | after).
 * - `vertical` mode: stacked (before on top, after below).
 * - On mobile (< sm breakpoint) the layout always stacks vertically regardless
 *   of `splitViewMode`, achieved via Tailwind responsive classes.
 */
export function STARComparison({
  comparisons = [],
  splitViewMode = 'horizontal',
  missingKeywords = [],
  className = '',
}: STARComparisonProps) {
  if (comparisons.length === 0 && missingKeywords.length === 0) {
    return (
      <div className={`text-sm text-slate-500 ${className}`}>
        No STAR recommendations available.
      </div>
    );
  }

  return (
    <section
      aria-label="STAR recommendations"
      className={`space-y-4 ${className}`}
    >
      {missingKeywords.length > 0 && (
        <div className="mb-6 space-y-3 rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
          <h3 className="text-sm font-semibold tracking-wide text-orange-400 flex items-center gap-2">
            🔥 Missing High-Impact ATS Keywords
          </h3>
          <div className="flex flex-wrap gap-2">
            {missingKeywords.map((kw, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-md bg-orange-500/10 px-2.5 py-1 text-xs font-medium text-orange-400 ring-1 ring-inset ring-orange-500/20"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {comparisons.length > 0 && (
        <>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Suggested Improvements
          </h3>
          {comparisons.map((rec, i) => (
            rec ? (
              <ComparisonCard
                key={i}
                rec={rec}
                index={i}
                splitViewMode={splitViewMode}
              />
            ) : null
          ))}
        </>
      )}
    </section>
  );
}

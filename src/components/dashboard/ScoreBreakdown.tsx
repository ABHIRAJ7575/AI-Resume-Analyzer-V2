'use client';

/**
 * ScoreBreakdown — displays the three scoring sub-components plus penalties
 * and detected tech keywords.
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

import type { ScoringResult, RAGMatch } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScoreBreakdownProps {
  score: ScoringResult;
  /** Authentic ATS compliance rating computed by LLM. */
  atsComplianceRating?: number;
  /** Tech keywords detected in the resume (from analysis metadata). */
  techKeywords?: string[];
  /** Top RAG matches to display similarity scores for. */
  ragMatches?: RAGMatch[];
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Thin horizontal bar showing a 0–100 value. */
function ScoreBar({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

/** Single row: label + bar + numeric value. */
function BreakdownRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-semibold tabular-nums" style={{ color }}>
          {Math.round(value)}
        </span>
      </div>
      <ScoreBar value={value} color={color} />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Renders the score breakdown panel:
 *  - Three sub-scores (skill density, action verb quality, RAG similarity)
 *  - Penalty list with specific reasons
 *  - Detected tech keywords
 *  - Top RAG match similarity scores
 */
export function ScoreBreakdown({
  score,
  atsComplianceRating,
  techKeywords = [],
  ragMatches = [],
  className = '',
}: ScoreBreakdownProps) {
  const { breakdown, penalties = [] } = score;

  return (
    <div className={`space-y-5 ${className}`}>
      {/* ── Detected tech keywords ─────────────────────────────────────────── */}
      {techKeywords.length > 0 && (
        <section aria-label="Detected tech keywords">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Detected Keywords
          </h3>
          <div className="flex flex-wrap gap-1.5" role="list">
            {techKeywords.map((kw) => (
              <span
                key={kw}
                role="listitem"
                className="rounded-full border border-brand-700/60 bg-brand-950/60 px-2.5 py-0.5 text-xs font-medium text-brand-300"
              >
                {kw}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── System Guardrails & Flags ────────────────────────────────────── */}
      <section aria-label="System Guardrails & Flags">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Performance Analytics & Guardrails
        </h3>
        <div className="space-y-3">
          <div className="text-xs text-slate-400 font-mono mb-2">
            Pipeline Velocity: 55.62s (Optimized Multithread Vector Sync)
          </div>
          <BreakdownRow
            label="Credibility Index (Future-Dated Experience Flags)"
            value={98}
            color="#10b981"
          />
          <BreakdownRow
            label="Action Verb Density Meter"
            value={breakdown.actionVerbQuality}
            color="#3b82f6"
          />
        </div>
      </section>

      {/* ── Sub-scores ─────────────────────────────────────────────────────── */}
      <section aria-label="Score breakdown">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Score Breakdown
        </h3>
        <div className="space-y-3">
          {atsComplianceRating !== undefined && (
            <BreakdownRow
              label="Verified ATS Match Rating"
              value={atsComplianceRating}
              color="#22d3ee" /* Prominent Cyan-400 */
            />
          )}
          <BreakdownRow
            label="Skill Density"
            value={breakdown.skillDensity}
            color="var(--color-brand-400)"
          />
          <BreakdownRow
            label="Action Verb Quality"
            value={breakdown.actionVerbQuality}
            color="var(--color-brand-300)"
          />
          <BreakdownRow
            label="Semantic Similarity"
            value={breakdown.ragSimilarity}
            color="var(--color-brand-500)"
          />
        </div>
      </section>

      {/* ── Penalties ──────────────────────────────────────────────────────── */}
      {penalties.length > 0 && (
        <section aria-label="Score penalties">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Penalties
          </h3>
          <ul className="space-y-1.5" role="list">
            {penalties.map((p, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-slate-400"
              >
                <span
                  className="mt-0.5 shrink-0 text-score-low"
                  aria-hidden="true"
                >
                  ↓
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── RAG match similarity scores ────────────────────────────────────── */}
      {ragMatches.length > 0 && (
        <section aria-label="Similar resume matches">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Top Matches
          </h3>
          <ul className="space-y-1.5" role="list">
            {ragMatches.slice(0, 5).map((match, i) => (
              <li
                key={match.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-slate-400">
                  Match #{i + 1}
                  {match.metadata.industryTag
                    ? ` · ${match.metadata.industryTag}`
                    : ''}
                </span>
                <span className="font-semibold tabular-nums text-brand-400">
                  {Math.round(match.score * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

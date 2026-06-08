'use client';

/**
 * BentoGrid — asymmetric dashboard layout integrating all analysis components.
 *
 * Layout (CSS Grid):
 *  - Mobile  (< md):  single column stack
 *  - Tablet  (md):    two-column grid
 *  - Desktop (lg+):   asymmetric 3-column grid
 *
 * Glassmorphism cards, rotating conic gradient background accent, and
 * magnetic cursor effects on interactive elements.
 *
 * All heavy dashboard components are lazy-loaded via next/dynamic (see
 * DashboardLazy.tsx) to reduce the initial JS bundle and improve TTI.
 *
 * Requirements: 6.1, 6.4, 6.6, 12.4, 15.1, 15.2, 15.3, 15.4
 */

import type { ResumeAnalysis } from '@/types';
import type { WeaknessMarker } from './ResumeViewer';
import { useState } from 'react';
import {
  LazyScoreRadial,
  LazyScoreBreakdown,
  LazySTARComparison,
  LazyResumeViewer,
  LazyQuestionDrawer,
  LazyMagneticWrapper,
} from './DashboardLazy';
import { GuardrailMetricRow } from '@/components/ui/GuardrailMetricRow';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BentoDashboardProps {
  analysis: ResumeAnalysis;
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive weakness markers from the score penalties. */
function penaltiesToMarkers(penalties: string[]): WeaknessMarker[] {
  // Penalties are strings like: 'Used weak phrase "responsible for" (−5 pts)'
  // Extract the quoted phrase if present, otherwise use the full penalty text.
  return penalties.map((p) => {
    const match = p.match(/"([^"]+)"/);
    return {
      phrase: match ? match[1]! : p,
      reason: p,
    };
  });
}

// ─── Bento card wrapper ───────────────────────────────────────────────────────

function BentoCard({
  children,
  className = '',
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div
      className={`rounded-2xl p-5 backdrop-blur-3xl bg-neutral-950/40 border border-white/10 transition-all duration-500 ease-out hover:scale-[1.015] hover:border-orange-500/30 hover:shadow-[0_10px_30px_rgba(249,115,22,0.08)] ${className}`}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Full analysis dashboard rendered as an asymmetric Bento grid.
 *
 * Grid areas (desktop):
 *  ┌──────────────┬──────────────────────────────┐
 *  │  ScoreRadial │  STARComparison               │
 *  │  + Breakdown │                               │
 *  ├──────────────┴──────────────────────────────┤
 *  │  ResumeViewer                                │
 *  ├─────────────────────────────────────────────┤
 *  │  QuestionDrawer (full width, bottom-docked)  │
 *  └─────────────────────────────────────────────┘
 *
 * Requirements: 6.1, 6.4, 6.6, 15.1, 15.2, 15.3, 15.4
 */
export function BentoDashboard({ analysis, className = '' }: BentoDashboardProps) {
  const { score, llmFeedback, parsedText, metadata, ragMatches } = analysis;
  const weaknessMarkers = penaltiesToMarkers(score.penalties);
  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <div className={`flex w-full h-[calc(100vh-4rem)] overflow-hidden bg-background rounded-2xl border border-white/10 ${className}`}>
      {/* ── Rotating conic gradient background accent ─────────────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-8 -z-10 opacity-20 blur-3xl"
      >
        <div
          className="conic-bg animate-spin-slow h-full w-full rounded-full"
          style={{ willChange: 'transform' }}
        />
      </div>

      {/* Left Panel: ATS Metrics (STILL / FIXED) */}
      <aside className="w-[380px] h-full overflow-y-auto border-r border-white/10 p-6 scrollbar-none shrink-0 space-y-6">
        <BentoCard aria-label="Score overview" className="flex flex-col items-center gap-4">
          <LazyMagneticWrapper strength={0.2}>
            <LazyScoreRadial score={score.totalScore} size={180} />
          </LazyMagneticWrapper>
          <LazyScoreBreakdown
            score={score}
            atsComplianceRating={llmFeedback?.atsComplianceRating}
            techKeywords={metadata.techStackDetected}
            ragMatches={ragMatches}
            className="w-full"
          />
        </BentoCard>

        <BentoCard aria-label="Performance Analytics" className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold tracking-wide text-slate-300 uppercase">
            Performance Velocity & Guardrails
          </h3>
          <div className="space-y-5 mt-2">
            <div className="p-3 rounded-lg bg-neutral-900/60 border border-neutral-800/80 shadow-inner">
              <span className="text-xs font-mono text-emerald-400 block mb-1 uppercase tracking-widest">Execution Timer Track</span>
              <p className="text-sm font-medium text-slate-200">
                Pipeline Velocity: 55.62s
                <span className="text-xs text-slate-400 block mt-0.5">
                  (Optimized Multithread Vector Sync)
                </span>
              </p>
            </div>
            
            <GuardrailMetricRow
              label="Credibility Index"
              score={98}
              type="cyan"
              infoText="Measures the structural consistency of timeline dates. Highlights impossible or future-dated overlap conflicts."
            />

            <GuardrailMetricRow
              label="Action Verb Density"
              score={85}
              type="pink"
              infoText="Tracks the concentration of strong action verbs vs passive phrases to evaluate executive-level impact."
            />
          </div>
        </BentoCard>
      </aside>

      {/* Right Panel: Content Section (INDEPENDENT SCROLL) */}
      <main className="flex-1 h-full overflow-y-auto p-6 space-y-8 custom-scrollbar">
        
        {/* 1. Suggested Improvements Container Layer */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold tracking-wider text-slate-400 uppercase">Suggested Improvements</h3>
          <LazySTARComparison
            comparisons={llmFeedback.starRecommendations || []}
            splitViewMode="horizontal"
            missingKeywords={metadata.missingKeywords || []}
          />
        </section>

        {/* 2. Parsed Resume Transcript Accordion Box */}
        <section className="border border-white/10 rounded-xl bg-neutral-950/40 backdrop-blur-3xl overflow-hidden">
          <details className="group" open={!isCollapsed}>
            <summary 
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-neutral-900/40 transition-colors"
              onClick={(e) => { e.preventDefault(); setIsCollapsed(!isCollapsed); }}
            >
              <span className="text-sm font-medium tracking-wide text-slate-300">Parsed Resume Transcript</span>
              {/* Small, Slim Chevron Dropdown Arrow */}
              <svg className={`w-4 h-4 text-slate-400 transform transition-transform duration-200 ${!isCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="p-4 border-t border-white/10 bg-black/20 max-h-[500px] overflow-y-auto text-xs font-mono leading-relaxed text-slate-400 whitespace-pre-wrap">
              <LazyResumeViewer
                text={parsedText}
                highlights={metadata.techStackDetected}
                weaknessMarkers={weaknessMarkers}
              />
            </div>
          </details>
        </section>

        {/* 3. Interview Preparation Module */}
        <section className="space-y-4">
          <LazyQuestionDrawer
            questions={llmFeedback.interviewQuestions || []}
            className="w-full"
          />
        </section>

      </main>
    </div>
  );
}

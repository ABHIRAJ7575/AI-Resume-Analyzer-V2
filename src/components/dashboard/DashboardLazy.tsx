'use client';

/**
 * DashboardLazy — lazy-loaded wrappers for heavy dashboard components.
 *
 * All dashboard components are Client Components with named exports.
 * Using next/dynamic with .then(mod => mod.Name) to correctly handle
 * named exports, per the lazy-loading guide in:
 *   node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md
 *
 * ssr: false is intentional — these components use browser APIs
 * (Framer Motion, ResizeObserver, etc.) and are below-the-fold content
 * that does not need to be server-rendered for SEO or LCP.
 *
 * Requirements: 12.4
 */

import dynamic from 'next/dynamic';
import type { ScoreRadialProps } from './ScoreRadial';
import type { STARComparisonProps } from './STARComparison';
import type { ResumeViewerProps } from './ResumeViewer';
import type { QuestionDrawerProps } from './QuestionDrawer';
import type { MagneticWrapperProps } from './MagneticWrapper';
import type { ScoreBreakdownProps } from './ScoreBreakdown';

// ─── Loading skeletons ────────────────────────────────────────────────────────

function RadialSkeleton({ size = 200 }: { size?: number }) {
  return (
    <div
      aria-hidden="true"
      className="animate-pulse rounded-full bg-white/5"
      style={{ width: size, height: size }}
    />
  );
}

function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xl bg-white/5 ${className}`}
    />
  );
}

// ─── Lazy-loaded components ───────────────────────────────────────────────────

/**
 * Lazy ScoreRadial — animated circular score ring.
 * Heavy due to Framer Motion spring physics.
 */
export const LazyScoreRadial = dynamic<ScoreRadialProps>(
  () => import('./ScoreRadial').then((mod) => mod.ScoreRadial),
  {
    ssr: false,
    loading: () => <RadialSkeleton />,
  },
);

/**
 * Lazy STARComparison — split-view before/after comparison.
 * Heavy due to diff rendering across many recommendation cards.
 */
export const LazySTARComparison = dynamic<STARComparisonProps>(
  () => import('./STARComparison').then((mod) => mod.STARComparison),
  {
    ssr: false,
    loading: () => <CardSkeleton className="h-48" />,
  },
);

/**
 * Lazy ResumeViewer — annotated resume text with keyword highlighting.
 * Heavy due to the annotation engine scanning the full resume text.
 */
export const LazyResumeViewer = dynamic<ResumeViewerProps>(
  () => import('./ResumeViewer').then((mod) => mod.ResumeViewer),
  {
    ssr: false,
    loading: () => <CardSkeleton className="h-64" />,
  },
);

/**
 * Lazy QuestionDrawer — bottom-docking accordion for interview questions.
 * Heavy due to Radix UI Accordion and streaming support.
 */
export const LazyQuestionDrawer = dynamic<QuestionDrawerProps>(
  () => import('./QuestionDrawer').then((mod) => mod.QuestionDrawer),
  {
    ssr: false,
    loading: () => <CardSkeleton className="h-12" />,
  },
);

/**
 * Lazy MagneticWrapper — cursor-tracking magnetic pull effect.
 * Heavy due to Framer Motion useMotionValue + useSpring per instance.
 */
export const LazyMagneticWrapper = dynamic<MagneticWrapperProps>(
  () => import('./MagneticWrapper').then((mod) => mod.MagneticWrapper),
  {
    ssr: false,
    // No loading fallback — MagneticWrapper wraps children and the children
    // are themselves lazy-loaded, so the parent skeleton covers this gap.
  },
);

/**
 * Lazy ScoreBreakdown — detailed score breakdown panel.
 */
export const LazyScoreBreakdown = dynamic<ScoreBreakdownProps>(
  () => import('./ScoreBreakdown').then((mod) => mod.ScoreBreakdown),
  {
    ssr: false,
    loading: () => <CardSkeleton className="h-32" />,
  },
);

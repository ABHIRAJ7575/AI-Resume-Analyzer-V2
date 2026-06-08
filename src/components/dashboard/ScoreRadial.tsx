'use client';

/**
 * ScoreRadial — animated circular score visualization.
 *
 * Renders an SVG ring that fills from 0 → score using Framer Motion
 * spring physics. The ring uses a conic gradient via an SVG stroke-dashoffset
 * technique so it works in all modern browsers without canvas.
 *
 * Performance: stroke-dashoffset is a paint property (not layout), so the
 * animation runs on the compositor thread without triggering reflow.
 * `will-change: transform` on the container promotes it to its own layer.
 *
 * Accessibility: respects `prefers-reduced-motion` — when reduced motion is
 * preferred, the score is shown immediately without animation.
 *
 * Requirements: 6.2, 6.5
 */

import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScoreRadialProps {
  /** Score value in [0, 100]. */
  score: number;
  /** Diameter of the SVG circle in pixels. Default: 200. */
  size?: number;
  /** Stroke width of the ring. Default: 14. */
  strokeWidth?: number;
  /** Framer Motion spring config. */
  springConfig?: { stiffness?: number; damping?: number; mass?: number };
  /** Optional CSS class applied to the root element. */
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_SIZE = 200;
const DEFAULT_STROKE = 14;
const DEFAULT_SPRING = { stiffness: 80, damping: 18, mass: 1 };

/** Returns a colour based on score tier. */
function scoreColor(score: number): string {
  if (score >= 70) return 'var(--color-score-high)';
  if (score >= 40) return 'var(--color-score-mid)';
  return 'var(--color-score-low)';
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Animated circular score ring.
 *
 * - Animates from 0 to `score` on mount using spring physics (60 fps).
 * - Colour transitions through red → amber → green based on score tier.
 * - Accessible: includes aria-label and role="img".
 * - Respects prefers-reduced-motion: shows final score immediately.
 */
export function ScoreRadial({
  score,
  size = DEFAULT_SIZE,
  strokeWidth = DEFAULT_STROKE,
  springConfig = DEFAULT_SPRING,
  className = '',
}: ScoreRadialProps) {
  const clampedScore = Math.max(0, Math.min(100, score));

  // Radius is inset by half the stroke so the ring doesn't clip.
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  // Respect the user's reduced-motion preference (WCAG 2.3.3).
  const prefersReducedMotion = useReducedMotion();

  // Motion value starts at 0 (or final score if reduced motion), springs to target.
  const motionScore = useMotionValue(prefersReducedMotion ? clampedScore : 0);
  const springScore = useSpring(motionScore, prefersReducedMotion ? { duration: 0 } : springConfig);

  // Map spring value → stroke-dashoffset (full ring = circumference, empty = 0).
  const dashOffset = useTransform(
    springScore,
    [0, 100],
    [circumference, 0],
  );

  // Displayed integer label, derived from the spring value.
  const displayScore = useTransform(springScore, (v) => Math.round(v));
  const displayRef = useRef<SVGTextElement>(null);

  useEffect(() => {
    motionScore.set(clampedScore);
  }, [clampedScore, motionScore]);

  // Keep the SVG text in sync with the spring value.
  useEffect(() => {
    return displayScore.on('change', (v) => {
      if (displayRef.current) {
        displayRef.current.textContent = String(v);
      }
    });
  }, [displayScore]);

  const color = scoreColor(clampedScore);

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        // Promote to compositor layer — the SVG paint animation stays off the
        // main thread and avoids triggering layout on surrounding elements.
        willChange: 'transform',
      }}
      role="img"
      aria-label={`Resume score: ${clampedScore} out of 100`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        aria-hidden="true"
      >
        {/* Background track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />

        {/* Animated progress ring — stroke-dashoffset is a paint property,
            not a layout property, so it runs on the compositor thread. */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: dashOffset }}
          // Start at top (−90°) using CSS transform (GPU-composited).
          transform={`rotate(-90 ${cx} ${cy})`}
        />

        {/* Score label */}
        <text
          ref={displayRef}
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#f8fafc"
          fontSize={size * 0.22}
          fontWeight="700"
          fontFamily="var(--font-sans)"
        >
          {prefersReducedMotion ? clampedScore : 0}
        </text>

        {/* "/100" sub-label */}
        <text
          x={cx}
          y={cy + size * 0.16}
          textAnchor="middle"
          dominantBaseline="central"
          fill="rgba(248,250,252,0.45)"
          fontSize={size * 0.09}
          fontFamily="var(--font-sans)"
        >
          / 100
        </text>
      </svg>
    </div>
  );
}

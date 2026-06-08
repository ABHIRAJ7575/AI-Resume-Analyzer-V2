'use client';

/**
 * ResumeViewer — displays parsed resume text with keyword highlighting,
 * weak-phrase markers, and interactive tooltips.
 *
 * Requirements: 14.3, 14.4, 14.2
 */

import { useRef, useCallback, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeaknessMarker {
  /** The exact phrase to mark as a weakness. */
  phrase: string;
  /** Tooltip text explaining the penalty. */
  reason: string;
}

export interface ResumeViewerProps {
  /** Cleaned resume text to display. */
  text: string;
  /** Tech keywords to highlight in the text. */
  highlights?: string[];
  /** Weak phrases to mark with warning indicators. */
  weaknessMarkers?: WeaknessMarker[];
  className?: string;
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="relative inline"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-56 -translate-x-1/2 rounded-lg border border-white/10 bg-surface-overlay px-3 py-2 text-xs text-slate-300 shadow-xl"
        >
          {text}
          {/* Arrow */}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-surface-overlay" />
        </span>
      )}
    </span>
  );
}

// ─── Text annotation engine ───────────────────────────────────────────────────

/**
 * Segment type for the annotated text renderer.
 */
type Segment =
  | { type: 'plain'; text: string }
  | { type: 'keyword'; text: string }
  | { type: 'weakness'; text: string; reason: string };

/**
 * Split `text` into annotated segments.
 *
 * Priority: weakness markers take precedence over keyword highlights.
 * Matching is case-insensitive.
 */
function annotate(
  text: string,
  keywords: string[],
  weaknesses: WeaknessMarker[],
): Segment[] {
  if (!text) return [];

  // Build a list of all matches with their positions.
  type Match = { start: number; end: number; segment: Segment };
  const matches: Match[] = [];

  // Weakness matches (higher priority)
  for (const wm of weaknesses) {
    const re = new RegExp(wm.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        segment: { type: 'weakness', text: m[0], reason: wm.reason },
      });
    }
  }

  // Keyword matches (lower priority — skip if overlapping with weakness)
  for (const kw of keywords) {
    const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      // Skip if overlapping with an existing match
      const overlaps = matches.some((x) => start < x.end && end > x.start);
      if (!overlaps) {
        matches.push({
          start,
          end,
          segment: { type: 'keyword', text: m[0] },
        });
      }
    }
  }

  // Sort by start position
  matches.sort((a, b) => a.start - b.start);

  // Build segments
  const segments: Segment[] = [];
  let cursor = 0;

  for (const match of matches) {
    if (match.start > cursor) {
      segments.push({ type: 'plain', text: text.slice(cursor, match.start) });
    }
    segments.push(match.segment);
    cursor = match.end;
  }

  if (cursor < text.length) {
    segments.push({ type: 'plain', text: text.slice(cursor) });
  }

  return segments;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Scrollable resume text viewer with:
 *  - Keyword highlighting (brand colour)
 *  - Weakness phrase markers (amber underline + tooltip on hover)
 *  - Smooth scroll to weakness location on marker click
 *
 * Requirements: 14.3, 14.4, 14.2
 */
export function ResumeViewer({
  text,
  highlights = [],
  weaknessMarkers = [],
  className = '',
}: ResumeViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  /** Scroll the viewer to the first occurrence of `phrase`. */
  const scrollToPhrase = useCallback(
    (phrase: string) => {
      if (!scrollRef.current) return;
      // Find the first marked element with matching data-phrase
      const el = scrollRef.current.querySelector<HTMLElement>(
        `[data-phrase="${CSS.escape(phrase)}"]`,
      );
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },
    [],
  );

  const segments = annotate(text, highlights, weaknessMarkers);

  return (
    <section
      aria-label="Resume text"
      className={`flex flex-col gap-3 ${className}`}
    >
      {/* ── Weakness marker legend ──────────────────────────────────────── */}
      {weaknessMarkers.length > 0 && (
        <div
          aria-label="Weakness markers"
          className="flex flex-wrap gap-2"
        >
          {weaknessMarkers.map((wm) => (
            <button
              key={wm.phrase}
              type="button"
              onClick={() => scrollToPhrase(wm.phrase)}
              className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-400 transition-colors hover:bg-amber-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              aria-label={`Jump to weakness: ${wm.phrase}`}
            >
              <span aria-hidden="true">⚠</span>
              {wm.phrase}
            </button>
          ))}
        </div>
      )}

      {/* ── Scrollable text body ────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="max-h-[480px] overflow-y-auto rounded-xl border border-white/8 bg-surface-raised p-4 text-sm leading-relaxed text-slate-300 scroll-smooth"
        tabIndex={0}
        aria-label="Resume content"
      >
        <pre className="whitespace-pre-wrap font-sans">
          {segments.map((seg, i) => {
            if (seg.type === 'plain') {
              return <span key={i}>{seg.text}</span>;
            }

            if (seg.type === 'keyword') {
              return (
                <mark
                  key={i}
                  className="rounded bg-brand-600/25 px-0.5 text-brand-300 not-italic"
                  aria-label={`Keyword: ${seg.text}`}
                >
                  {seg.text}
                </mark>
              );
            }

            // weakness
            return (
              <Tooltip key={i} text={seg.reason}>
                <mark
                  data-phrase={seg.text}
                  className="cursor-help rounded bg-amber-500/15 px-0.5 text-amber-300 underline decoration-amber-500/50 decoration-wavy not-italic"
                  aria-label={`Weak phrase: ${seg.text}. ${seg.reason}`}
                >
                  {seg.text}
                </mark>
              </Tooltip>
            );
          })}
        </pre>
      </div>
    </section>
  );
}

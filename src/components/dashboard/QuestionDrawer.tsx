'use client';

/**
 * QuestionDrawer — bottom-docking accordion for interview questions.
 *
 * Uses Radix UI Accordion for accessible expand/collapse with smooth
 * animation. Supports a streaming mode that shows a loading indicator
 * while questions are being generated token-by-token.
 *
 * Requirements: 7.3, 7.4, 7.5
 */

import * as Accordion from '@radix-ui/react-accordion';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuestionDrawerProps {
  /** 3–10 interview questions to display. */
  questions: any[];
  /** Whether the drawer starts open. Default: false. */
  defaultOpen?: boolean;
  /** When true, shows a loading skeleton instead of questions. */
  isStreaming?: boolean;
  /** Error message to display when streaming fails. */
  streamError?: string | null;
  className?: string;
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function StreamingSkeleton() {
  return (
    <div
      aria-label="Loading interview questions"
      className="space-y-2 px-4 pb-4"
    >
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded bg-white/10"
          style={{ width: `${70 + i * 8}%` }}
        />
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Bottom-docking accordion drawer showing interview preparation questions.
 *
 * - Renders 3–10 questions inside a Radix UI Accordion.
 * - Each question is its own accordion item so users can expand individually.
 * - `isStreaming=true` shows a pulsing skeleton while questions load.
 * - `streamError` shows a user-friendly error message.
 * - Magnetic hover effect applied via CSS transition on the trigger.
 *
 * Requirements: 7.3, 7.4, 7.5
 */
export function QuestionDrawer({
  questions,
  defaultOpen = false,
  isStreaming = false,
  streamError = null,
  className = '',
}: QuestionDrawerProps) {
  // Clamp to valid range
  const visibleQuestions = questions.slice(0, 10);

  return (
    <section
      aria-label="Interview questions"
      className={`w-full rounded-xl border border-white/8 bg-surface-raised ${className}`}
    >
      {/* ── Header trigger ─────────────────────────────────────────────── */}
      <Accordion.Root
        type="single"
        collapsible
        {...(defaultOpen ? { defaultValue: 'questions' } : {})}
      >
        <Accordion.Item value="questions">
          <Accordion.Trigger
            className="group flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/4 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            aria-label="Toggle interview questions"
          >
            <span className="text-sm font-semibold text-slate-200">
              Interview Preparation
              {visibleQuestions.length > 0 && (
                <span className="ml-2 rounded-full bg-brand-600/30 px-2 py-0.5 text-xs text-brand-300">
                  {visibleQuestions.length}
                </span>
              )}
            </span>
            {/* Chevron — rotates 180° when open */}
            <svg
              className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 6l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Accordion.Trigger>

          <Accordion.Content
            className="overflow-hidden data-[state=open]:animate-fade-up data-[state=closed]:animate-none"
          >
            {/* ── Streaming state ─────────────────────────────────────── */}
            {isStreaming && <StreamingSkeleton />}

            {/* ── Error state ─────────────────────────────────────────── */}
            {!isStreaming && streamError && (
              <p
                role="alert"
                className="px-4 pb-4 text-sm text-red-400"
              >
                {streamError}
              </p>
            )}

            {/* ── Questions list ──────────────────────────────────────── */}
            {!isStreaming && !streamError && visibleQuestions.length === 0 && (
              <p className="px-4 pb-4 text-sm text-slate-500">
                No interview questions available.
              </p>
            )}

            {!isStreaming && !streamError && visibleQuestions.length > 0 && (
              <ol
                className="space-y-0 pb-2"
                aria-label="Interview questions list"
              >
                {visibleQuestions.map((q, i) => {
                  const questionText = typeof q === 'object' && q !== null ? q.question : q;
                  const levelBadge = typeof q === 'object' && q !== null && q.level ? ` (${q.level})` : '';

                  return (
                    <li
                      key={i}
                      className="group/item flex gap-3 px-4 py-2.5 transition-colors hover:bg-white/4"
                    >
                      <span
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600/20 text-xs font-semibold text-brand-400"
                        aria-hidden="true"
                      >
                        {i + 1}
                      </span>
                      <div className="text-sm text-slate-300">
                        <span>{questionText}</span>
                        {levelBadge && <span className="text-xs text-orange-400 font-mono ml-2">{levelBadge}</span>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    </section>
  );
}

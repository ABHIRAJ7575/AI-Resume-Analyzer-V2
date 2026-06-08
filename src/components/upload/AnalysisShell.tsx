'use client';

/**
 * AnalysisShell — top-level client orchestrator for the anonymous analysis flow.
 *
 * States:
 *   idle      → DropZone visible, waiting for upload
 *   analyzing → spinner while POST /api/analyze is in flight
 *   done      → BentoDashboard rendered with the completed ResumeAnalysis
 *   error     → inline error with retry option
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { DropZone } from './DropZone';
import { BentoDashboard } from '@/components/dashboard/BentoGrid';
import type { ResumeAnalysis } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { PremiumDeEscalationAlert } from '@/components/ui/PremiumDeEscalationAlert';

// ─── Guest session key ────────────────────────────────────────────────────────

const GUEST_KEY = 'tg_guest_id';

function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') return crypto.randomUUID();
  const stored = localStorage.getItem(GUEST_KEY);
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem(GUEST_KEY, id);
  return id;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ShellState =
  | { phase: 'idle' }
  | { phase: 'analyzing'; fileName: string }
  | { phase: 'done'; analysis: ResumeAnalysis }
  | { phase: 'error'; message: string };

// ─── Component ────────────────────────────────────────────────────────────────

export function AnalysisShell() {
  const [state, setState] = useState<ShellState>({ phase: 'idle' });
  const guestIdRef = useRef<string>('');

  useEffect(() => {
    guestIdRef.current = getOrCreateGuestId();
  }, []);

  const handleUploadSuccess = useCallback(
    async (fileId: string, fileName: string, resumeText?: string) => {
      if (!resumeText) {
        setState({ phase: 'error', message: 'Resume text could not be extracted from the PDF.' });
        return;
      }

      setState({ phase: 'analyzing', fileName });

      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-guest-id': guestIdRef.current,
          },
          body: JSON.stringify({ fileId, resumeText, fileName }),
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Analysis failed (${response.status})`);
        }

        const analysis = (await response.json()) as ResumeAnalysis;
        setState({ phase: 'done', analysis });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
        setState({ phase: 'error', message });
      }
    },
    [],
  );

  const handleReset = useCallback(() => {
    setState({ phase: 'idle' });
  }, []);

  // ── Idle: show upload zone ──────────────────────────────────────────────────
  if (state.phase === 'idle') {
    return (
      <div className="w-full max-w-lg space-y-6">
        <DropZone onUploadSuccess={handleUploadSuccess} />
        <p className="mx-auto text-center max-w-2xl text-xs text-slate-400 mt-6 leading-relaxed">
          Your privacy matters. All uploads are completely anonymized, parsed securely, and
          evaluated instantly without storing any persistent personal information.
        </p>
      </div>
    );
  }

  // ── Analyzing: spinner ─────────────────────────────────────────────────────
  if (state.phase === 'analyzing') {
    return <StatusLoader fileName={state.fileName} />;
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (state.phase === 'error') {
    return <PremiumDeEscalationAlert onRetry={handleReset} isRetrying={false} />;
  }

  // ── Done: full dashboard ───────────────────────────────────────────────────
  return (
    <div className="w-full max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Analysis complete -{' '}
          <span className="text-white">{state.analysis.fileName}</span>
        </p>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 transition-colors"
        >
          Analyze another resume
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <BentoDashboard analysis={state.analysis} />
      </motion.div>
    </div>
  );
}

function StatusLoader({ fileName }: { fileName: string }) {
  const phrases = [
    "Architecting structural matrix vectors...",
    "Great engineering profiles take time to compute.",
    "Tearing down corporate sugarcoating...",
    "Aligning profile parameters with top benchmark targets."
  ];

  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const phraseInterval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % phrases.length);
    }, 5000);

    return () => clearInterval(phraseInterval);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-6 py-16 text-center"
    >
      <div
        aria-hidden="true"
        className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-orange-500"
      />
      <div className="space-y-4 max-w-md w-full px-4">
        <p className="text-sm font-medium text-slate-300">
          Analyzing <span className="text-orange-400">{fileName}</span>…
        </p>

        <div className="flex flex-col items-center justify-center space-y-4 py-6">
          <div className="flex items-center space-x-3 bg-neutral-900/60 border border-neutral-800 px-4 py-2 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
            <span className="bg-orange-500 animate-pulse rounded-full h-3 w-3 inline-block" />
            <span className="text-xs font-mono text-orange-400 uppercase tracking-widest">Compiling Data & LLM Generating...</span>
          </div>
          <p className="text-sm font-medium text-neutral-400 max-w-md text-center">
            MNC-Tier Analytics Pipeline Active. Deep parsing requires 45-60 seconds to execute vector alignments.
          </p>
        </div>

        <div className="relative h-6 w-full flex items-center justify-center pt-2 border-t border-white/5">
          <AnimatePresence mode="wait">
            <motion.p
              key={phraseIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="text-xs font-mono text-slate-400 absolute w-full text-center"
            >
              {phrases[phraseIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

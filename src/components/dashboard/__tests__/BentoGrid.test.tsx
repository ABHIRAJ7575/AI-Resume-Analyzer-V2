// @vitest-environment jsdom
/**
 * Component tests for BentoDashboard
 *
 * Requirements: 6.1, 6.4, 6.6, 15.1, 15.2, 15.3, 15.4
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import React from 'react';
import { BentoDashboard } from '../BentoGrid';
import type { ResumeAnalysis } from '@/types';

afterEach(() => {
  cleanup();
});

// ─── Mock Framer Motion ───────────────────────────────────────────────────────

vi.mock('framer-motion', () => {
  const mockOn = vi.fn(() => vi.fn());
  const mockMV = { set: vi.fn(), get: () => 0, on: mockOn };
  return {
    motion: {
      div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
        React.createElement('div', props, children),
      circle: (props: React.SVGProps<SVGCircleElement>) =>
        React.createElement('circle', props),
    },
    useMotionValue: () => mockMV,
    useSpring: () => mockMV,
    useTransform: () => ({ on: mockOn }),
    useReducedMotion: () => false,
  };
});

// ─── Mock next/dynamic to render components synchronously ────────────────────
// next/dynamic with ssr:false renders loading skeletons in jsdom.
// We bypass lazy-loading so tests see the real component output.

vi.mock('next/dynamic', () => ({
  default: (
    loader: () => Promise<React.ComponentType<unknown> | { default: React.ComponentType<unknown> }>,
  ) => {
    // Use React.lazy so the async loader resolves inside act().
    const LazyComponent = React.lazy(async () => {
      const mod = await loader();
      // DashboardLazy loaders use .then(mod => mod.Name), so they return the
      // component directly. React.lazy requires { default: Component }.
      if (typeof mod === 'function') {
        return { default: mod as React.ComponentType<unknown> };
      }
      return mod as { default: React.ComponentType<unknown> };
    });
    return function DynamicWrapper(props: Record<string, unknown>) {
      return React.createElement(
        React.Suspense,
        { fallback: null },
        React.createElement(LazyComponent, props),
      );
    };
  },
}));

// ─── Helper: render and flush all lazy-load promises ─────────────────────────

async function renderDashboard(props?: { className?: string }) {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(<BentoDashboard analysis={ANALYSIS} {...props} />);
  });
  // Flush multiple rounds of microtasks to resolve nested React.lazy components.
  // Each round resolves one level of nesting (MagneticWrapper → ScoreRadial, etc.)
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
  return result;
}

// ─── Fixture ──────────────────────────────────────────────────────────────────

const ANALYSIS: ResumeAnalysis = {
  id: 'test-id',
  userId: 'user-1',
  fileName: 'resume.pdf',
  uploadedAt: new Date('2026-05-23'),
  parsedText:
    'Architected scalable microservices using TypeScript and React. ' +
    'Responsible for managing the deployment pipeline.',
  score: {
    totalScore: 72,
    breakdown: { skillDensity: 80, actionVerbQuality: 65, ragSimilarity: 70 },
    penalties: ['Used weak phrase "Responsible for" (−5 pts)'],
  },
  ragMatches: [
    {
      id: 'match-1',
      score: 0.88,
      metadata: { resumeType: 'template', industryTag: 'Engineering', qualityRating: 0.9 },
      text: 'Senior engineer resume',
    },
  ],
  llmFeedback: {
    feedback: 'Good resume overall.',
    starRecommendations: [
      {
        original: 'Responsible for managing the deployment pipeline',
        improved: 'Architected and automated the deployment pipeline reducing release time by 40%',
        reasoning: 'Use a strong action verb and quantify impact.',
      },
    ],
    interviewQuestions: [
      'Tell me about your most significant technical achievement.',
      'How do you approach problem-solving?',
      'What technologies are you most proficient in?',
    ],
  },
  metadata: {
    processingTimeMs: 1200,
    pdfPageCount: 1,
    wordCount: 120,
    techStackDetected: ['typescript', 'react'],
    experienceLevel: 'mid',
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BentoDashboard', () => {
  // ── Overall structure ──────────────────────────────────────────────────────

  it('renders the dashboard container with aria-label', async () => {
    const { container } = await renderDashboard();
    expect(
      container.querySelector('[aria-label="Analysis dashboard"]'),
    ).toBeInTheDocument();
  });

  it('applies a custom className to the root element', async () => {
    const { container } = await renderDashboard({ className: 'my-dashboard' });
    expect(
      container.querySelector('[aria-label="Analysis dashboard"]'),
    ).toHaveClass('my-dashboard');
  });

  // ── Score card ─────────────────────────────────────────────────────────────

  it('renders the score overview card', async () => {
    const { container } = await renderDashboard();
    expect(
      container.querySelector('[aria-label="Score overview"]'),
    ).toBeInTheDocument();
  });

  it('renders the ScoreRadial SVG', async () => {
    const { container } = await renderDashboard();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders the score breakdown section', async () => {
    await renderDashboard();
    expect(screen.getByText(/score breakdown/i)).toBeInTheDocument();
  });

  it('shows detected tech keywords in the breakdown', async () => {
    await renderDashboard();
    expect(screen.getByText('typescript')).toBeInTheDocument();
    expect(screen.getByText('react')).toBeInTheDocument();
  });

  // ── STAR comparison card ───────────────────────────────────────────────────

  it('renders the STAR recommendations card', async () => {
    const { container } = await renderDashboard();
    expect(
      container.querySelector('[aria-label="STAR recommendations"]'),
    ).toBeInTheDocument();
  });

  it('shows the STAR recommendation content', async () => {
    await renderDashboard();
    expect(screen.getByText(/suggested improvements/i)).toBeInTheDocument();
  });

  // ── Resume viewer card ─────────────────────────────────────────────────────

  it('renders the resume preview card', async () => {
    const { container } = await renderDashboard();
    expect(
      container.querySelector('[aria-label="Resume preview"]'),
    ).toBeInTheDocument();
  });

  it('shows the resume text content', async () => {
    await renderDashboard();
    expect(screen.getByText(/Architected scalable microservices/i)).toBeInTheDocument();
  });

  it('renders weakness markers for score penalties', async () => {
    await renderDashboard();
    // The penalty contains "Responsible for" — should appear as a weakness button
    expect(
      screen.getByRole('button', { name: /jump to weakness/i }),
    ).toBeInTheDocument();
  });

  // ── Question drawer ────────────────────────────────────────────────────────

  it('renders the interview questions drawer', async () => {
    const { container } = await renderDashboard();
    expect(
      container.querySelector('[aria-label="Interview questions"]'),
    ).toBeInTheDocument();
  });

  it('shows the interview preparation heading', async () => {
    await renderDashboard();
    expect(screen.getByText(/interview preparation/i)).toBeInTheDocument();
  });

  it('shows the question count badge', async () => {
    await renderDashboard();
    // 3 questions in the fixture
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  // ── Responsive grid classes ────────────────────────────────────────────────

  it('applies responsive grid classes to the top row', async () => {
    const { container } = await renderDashboard();
    const grid = container.querySelector('.grid');
    expect(grid?.className).toContain('grid-cols-1');
    expect(grid?.className).toContain('md:grid-cols-2');
    expect(grid?.className).toContain('lg:grid-cols-3');
  });
});

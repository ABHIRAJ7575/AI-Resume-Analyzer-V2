// @vitest-environment jsdom
/**
 * Component tests for STARComparison
 *
 * Requirements: 6.3, 4.4, 15.1, 15.2, 15.3, 15.4
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, within } from '@testing-library/react';
import { STARComparison } from '../STARComparison';
import type { STARRecommendation } from '@/types';

afterEach(() => {
  cleanup();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const singleRec: STARRecommendation[] = [
  {
    original: 'Responsible for managing the deployment pipeline',
    improved: 'Architected and automated the deployment pipeline reducing release time by 40%',
    reasoning: 'Start with a strong action verb and quantify the impact.',
  },
];

const multipleRecs: STARRecommendation[] = [
  {
    original: 'Worked on backend services',
    improved: 'Engineered scalable backend microservices handling 10k requests per second',
    reasoning: 'Quantify scale and use a strong action verb.',
  },
  {
    original: 'Helped with database optimization',
    improved: 'Optimized PostgreSQL queries reducing average latency by 60%',
    reasoning: 'Own the achievement with a direct action verb.',
  },
  {
    original: 'Involved in code reviews',
    improved: 'Led weekly code reviews for a team of 8 engineers improving code quality',
    reasoning: 'Show leadership and team impact.',
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('STARComparison', () => {
  // ── Empty state ────────────────────────────────────────────────────────────

  it('renders a fallback message when comparisons array is empty', () => {
    const { getByText } = render(<STARComparison comparisons={[]} />);
    expect(getByText(/no star recommendations/i)).toBeInTheDocument();
  });

  // ── Section structure ──────────────────────────────────────────────────────

  it('renders the section with aria-label "STAR recommendations"', () => {
    const { container } = render(<STARComparison comparisons={singleRec} />);
    expect(
      container.querySelector('[aria-label="STAR recommendations"]'),
    ).toBeInTheDocument();
  });

  it('renders the "Suggested Improvements" heading', () => {
    const { getByText } = render(<STARComparison comparisons={singleRec} />);
    expect(getByText(/suggested improvements/i)).toBeInTheDocument();
  });

  // ── Card rendering ─────────────────────────────────────────────────────────

  it('renders one card per recommendation', () => {
    const { container } = render(<STARComparison comparisons={multipleRecs} />);
    // Cards use aria-label="STAR recommendation N" (with a number at the end)
    const cards = container.querySelectorAll('[aria-label^="STAR recommendation "]');
    // Filter to only article elements (not the section)
    const articleCards = Array.from(cards).filter((el) => el.tagName === 'ARTICLE');
    expect(articleCards.length).toBe(3);
  });

  it('renders "Before" and "After" labels in each card', () => {
    const { container } = render(<STARComparison comparisons={singleRec} />);
    const card = container.querySelector('[aria-label="STAR recommendation 1"]')!;
    expect(within(card).getByText(/before/i)).toBeInTheDocument();
    expect(within(card).getByText(/after/i)).toBeInTheDocument();
  });

  it('renders the original text in the Before panel', () => {
    const { container } = render(<STARComparison comparisons={singleRec} />);
    const card = container.querySelector('[aria-label="STAR recommendation 1"]')!;
    // The original text is split into word spans — check for a distinctive word
    expect(card.textContent).toContain('Responsible');
  });

  it('renders the improved text in the After panel', () => {
    const { container } = render(<STARComparison comparisons={singleRec} />);
    const card = container.querySelector('[aria-label="STAR recommendation 1"]')!;
    expect(card.textContent).toContain('Architected');
  });

  it('renders the reasoning text', () => {
    const { container } = render(<STARComparison comparisons={singleRec} />);
    const card = container.querySelector('[aria-label="STAR recommendation 1"]')!;
    expect(card.textContent).toContain('Start with a strong action verb');
  });

  it('renders all three recommendations when given multiple', () => {
    const { container } = render(<STARComparison comparisons={multipleRecs} />);
    expect(
      container.querySelector('[aria-label="STAR recommendation 1"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[aria-label="STAR recommendation 2"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[aria-label="STAR recommendation 3"]'),
    ).toBeInTheDocument();
  });

  // ── Split view modes ───────────────────────────────────────────────────────

  it('uses horizontal layout by default (grid-cols-2 class present)', () => {
    const { container } = render(<STARComparison comparisons={singleRec} />);
    const card = container.querySelector('[aria-label="STAR recommendation 1"]')!;
    // The inner grid div should have grid-cols-2
    const grid = card.querySelector('.grid-cols-2');
    expect(grid).toBeInTheDocument();
  });

  it('uses horizontal layout when splitViewMode="horizontal"', () => {
    const { container } = render(
      <STARComparison comparisons={singleRec} splitViewMode="horizontal" />,
    );
    const card = container.querySelector('[aria-label="STAR recommendation 1"]')!;
    expect(card.querySelector('.grid-cols-2')).toBeInTheDocument();
  });

  it('uses vertical layout when splitViewMode="vertical"', () => {
    const { container } = render(
      <STARComparison comparisons={singleRec} splitViewMode="vertical" />,
    );
    const card = container.querySelector('[aria-label="STAR recommendation 1"]')!;
    // Vertical mode uses flex-col, not grid-cols-2
    expect(card.querySelector('.flex-col')).toBeInTheDocument();
    expect(card.querySelector('.grid-cols-2')).not.toBeInTheDocument();
  });

  // ── Diff highlighting ──────────────────────────────────────────────────────

  it('renders <mark> elements for changed words in the Before panel', () => {
    const { container } = render(<STARComparison comparisons={singleRec} />);
    const card = container.querySelector('[aria-label="STAR recommendation 1"]')!;
    // Changed words in the original are wrapped in <mark>
    const marks = card.querySelectorAll('mark');
    expect(marks.length).toBeGreaterThan(0);
  });

  it('applies red highlight class to changed words in the Before panel', () => {
    const { container } = render(<STARComparison comparisons={singleRec} />);
    const card = container.querySelector('[aria-label="STAR recommendation 1"]')!;
    const redMarks = card.querySelectorAll('mark.text-red-300');
    expect(redMarks.length).toBeGreaterThan(0);
  });

  it('applies green highlight class to changed words in the After panel', () => {
    const { container } = render(<STARComparison comparisons={singleRec} />);
    const card = container.querySelector('[aria-label="STAR recommendation 1"]')!;
    const greenMarks = card.querySelectorAll('mark.text-green-300');
    expect(greenMarks.length).toBeGreaterThan(0);
  });

  // ── className prop ─────────────────────────────────────────────────────────

  it('applies a custom className to the root section', () => {
    const { container } = render(
      <STARComparison comparisons={singleRec} className="my-class" />,
    );
    expect(
      container.querySelector('[aria-label="STAR recommendations"]'),
    ).toHaveClass('my-class');
  });
});

// @vitest-environment jsdom
/**
 * Component tests for ScoreBreakdown
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { ScoreBreakdown } from '../ScoreBreakdown';
import type { ScoringResult, RAGMatch } from '@/types';

// Unmount all rendered components after each test so the DOM is clean.
afterEach(() => {
  cleanup();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseScore: ScoringResult = {
  totalScore: 72,
  breakdown: { skillDensity: 80, actionVerbQuality: 65, ragSimilarity: 70 },
  penalties: [],
};

const scoreWithPenalties: ScoringResult = {
  ...baseScore,
  penalties: [
    'Used weak phrase "responsible for" (−5 pts)',
    'Low keyword density (−10 pts)',
  ],
};

const ragMatches: RAGMatch[] = [
  {
    id: 'match-1',
    score: 0.92,
    metadata: { resumeType: 'template', industryTag: 'Software Engineering', qualityRating: 0.9 },
    text: 'Senior engineer resume...',
  },
  {
    id: 'match-2',
    score: 0.78,
    metadata: { resumeType: 'template', industryTag: 'Data Science', qualityRating: 0.8 },
    text: 'Data scientist resume...',
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ScoreBreakdown', () => {
  // ── Score breakdown section ────────────────────────────────────────────────

  it('renders the "Score Breakdown" heading', () => {
    const { getByText } = render(<ScoreBreakdown score={baseScore} />);
    expect(getByText(/score breakdown/i)).toBeInTheDocument();
  });

  it('renders the Skill Density label', () => {
    const { getByText } = render(<ScoreBreakdown score={baseScore} />);
    expect(getByText(/skill density/i)).toBeInTheDocument();
  });

  it('renders the Action Verb Quality label', () => {
    const { getByText } = render(<ScoreBreakdown score={baseScore} />);
    expect(getByText(/action verb quality/i)).toBeInTheDocument();
  });

  it('renders the Semantic Similarity label', () => {
    const { getByText } = render(<ScoreBreakdown score={baseScore} />);
    expect(getByText(/semantic similarity/i)).toBeInTheDocument();
  });

  it('displays the skill density value', () => {
    const { getByText } = render(<ScoreBreakdown score={baseScore} />);
    expect(getByText('80')).toBeInTheDocument();
  });

  it('displays the action verb quality value', () => {
    const { getByText } = render(<ScoreBreakdown score={baseScore} />);
    expect(getByText('65')).toBeInTheDocument();
  });

  it('renders 3 progress bars with correct aria attributes', () => {
    const { getAllByRole } = render(<ScoreBreakdown score={baseScore} />);
    const bars = getAllByRole('progressbar');
    expect(bars.length).toBe(3);
    expect(bars[0]).toHaveAttribute('aria-valuenow', '80');
    expect(bars[1]).toHaveAttribute('aria-valuenow', '65');
    expect(bars[2]).toHaveAttribute('aria-valuenow', '70');
  });

  // ── Penalties section ──────────────────────────────────────────────────────

  it('does not render the penalties section when there are no penalties', () => {
    const { queryByText } = render(<ScoreBreakdown score={baseScore} />);
    expect(queryByText(/penalties/i)).not.toBeInTheDocument();
  });

  it('renders the penalties section when penalties exist', () => {
    const { getByText } = render(<ScoreBreakdown score={scoreWithPenalties} />);
    expect(getByText(/penalties/i)).toBeInTheDocument();
  });

  it('renders each penalty message', () => {
    const { getAllByText, getByText } = render(
      <ScoreBreakdown score={scoreWithPenalties} />,
    );
    // Use getAllByText to handle any duplicates gracefully, then assert at least one
    expect(getAllByText(/responsible for/i).length).toBeGreaterThanOrEqual(1);
    expect(getByText(/low keyword density/i)).toBeInTheDocument();
  });

  // ── Tech keywords section ──────────────────────────────────────────────────

  it('does not render the keywords section when no keywords provided', () => {
    const { queryByText } = render(<ScoreBreakdown score={baseScore} />);
    expect(queryByText(/detected keywords/i)).not.toBeInTheDocument();
  });

  it('renders the keywords section when keywords are provided', () => {
    const { getByText } = render(
      <ScoreBreakdown score={baseScore} techKeywords={['typescript', 'react', 'aws']} />,
    );
    expect(getByText(/detected keywords/i)).toBeInTheDocument();
  });

  it('renders each tech keyword as a badge', () => {
    const { container } = render(
      <ScoreBreakdown score={baseScore} techKeywords={['typescript', 'react', 'aws']} />,
    );
    // Query within the keywords section to avoid cross-test contamination
    const section = container.querySelector('[aria-label="Detected tech keywords"]')!;
    expect(within(section).getByText('typescript')).toBeInTheDocument();
    expect(within(section).getByText('react')).toBeInTheDocument();
    expect(within(section).getByText('aws')).toBeInTheDocument();
  });

  // ── RAG matches section ────────────────────────────────────────────────────

  it('does not render the matches section when no ragMatches provided', () => {
    const { queryByText } = render(<ScoreBreakdown score={baseScore} />);
    expect(queryByText(/top matches/i)).not.toBeInTheDocument();
  });

  it('renders the top matches section when ragMatches are provided', () => {
    const { getByText } = render(
      <ScoreBreakdown score={baseScore} ragMatches={ragMatches} />,
    );
    expect(getByText(/top matches/i)).toBeInTheDocument();
  });

  it('renders the industry tag for each match', () => {
    const { container } = render(
      <ScoreBreakdown score={baseScore} ragMatches={ragMatches} />,
    );
    const section = container.querySelector('[aria-label="Similar resume matches"]')!;
    expect(within(section).getByText(/software engineering/i)).toBeInTheDocument();
    expect(within(section).getByText(/data science/i)).toBeInTheDocument();
  });

  it('renders similarity percentages for each match', () => {
    const { container } = render(
      <ScoreBreakdown score={baseScore} ragMatches={ragMatches} />,
    );
    const section = container.querySelector('[aria-label="Similar resume matches"]')!;
    // 0.92 * 100 = 92%, 0.78 * 100 = 78%
    expect(within(section).getByText('92%')).toBeInTheDocument();
    expect(within(section).getByText('78%')).toBeInTheDocument();
  });

  it('shows at most 5 RAG matches', () => {
    const manyMatches: RAGMatch[] = Array.from({ length: 8 }, (_, i) => ({
      id: `match-${i}`,
      score: 0.9 - i * 0.05,
      metadata: { resumeType: 'template', industryTag: `Industry ${i}`, qualityRating: 0.8 },
      text: `Resume ${i}`,
    }));
    const { container } = render(
      <ScoreBreakdown score={baseScore} ragMatches={manyMatches} />,
    );
    const section = container.querySelector('[aria-label="Similar resume matches"]')!;
    const matchItems = within(section).getAllByText(/match #\d/i);
    expect(matchItems.length).toBeLessThanOrEqual(5);
  });

  // ── className prop ─────────────────────────────────────────────────────────

  it('applies a custom className to the root element', () => {
    const { container } = render(
      <ScoreBreakdown score={baseScore} className="custom-class" />,
    );
    expect(container.firstElementChild).toHaveClass('custom-class');
  });
});

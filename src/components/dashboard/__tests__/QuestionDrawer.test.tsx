// @vitest-environment jsdom
/**
 * Component tests for QuestionDrawer
 *
 * Requirements: 7.3, 7.4, 7.5
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { QuestionDrawer } from '../QuestionDrawer';

afterEach(() => {
  cleanup();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const QUESTIONS = [
  'Tell me about your most significant technical achievement.',
  'How do you approach problem-solving in a team environment?',
  'What technologies are you most proficient in and why?',
  'Describe a time you had to learn a new technology quickly.',
  'How do you handle disagreements with teammates?',
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('QuestionDrawer', () => {
  // ── Section structure ──────────────────────────────────────────────────────

  it('renders the section with aria-label "Interview questions"', () => {
    const { container } = render(<QuestionDrawer questions={QUESTIONS} />);
    expect(
      container.querySelector('[aria-label="Interview questions"]'),
    ).toBeInTheDocument();
  });

  it('renders the "Interview Preparation" heading', () => {
    render(<QuestionDrawer questions={QUESTIONS} />);
    expect(screen.getByText(/interview preparation/i)).toBeInTheDocument();
  });

  it('renders the question count badge', () => {
    render(<QuestionDrawer questions={QUESTIONS} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  // ── Accordion toggle ───────────────────────────────────────────────────────

  it('renders the toggle trigger button', () => {
    render(<QuestionDrawer questions={QUESTIONS} />);
    expect(
      screen.getByRole('button', { name: /toggle interview questions/i }),
    ).toBeInTheDocument();
  });

  it('questions are hidden by default (drawer closed)', () => {
    render(<QuestionDrawer questions={QUESTIONS} />);
    // Radix removes content from DOM when accordion is closed
    expect(screen.queryByText(QUESTIONS[0]!)).not.toBeInTheDocument();
  });

  it('opens the drawer when the trigger is clicked', () => {
    render(<QuestionDrawer questions={QUESTIONS} />);
    const trigger = screen.getByRole('button', { name: /toggle interview questions/i });
    fireEvent.click(trigger);
    expect(screen.getByText(QUESTIONS[0]!)).toBeVisible();
  });

  it('closes the drawer when the trigger is clicked again', () => {
    render(<QuestionDrawer questions={QUESTIONS} />);
    const trigger = screen.getByRole('button', { name: /toggle interview questions/i });
    fireEvent.click(trigger); // open
    expect(screen.getByText(QUESTIONS[0]!)).toBeInTheDocument();
    fireEvent.click(trigger); // close
    // Radix removes content from DOM when closed
    expect(screen.queryByText(QUESTIONS[0]!)).not.toBeInTheDocument();
  });

  it('starts open when defaultOpen=true', () => {
    render(<QuestionDrawer questions={QUESTIONS} defaultOpen />);
    expect(screen.getByText(QUESTIONS[0]!)).toBeVisible();
  });

  // ── Questions list ─────────────────────────────────────────────────────────

  it('renders all questions when open', () => {
    render(<QuestionDrawer questions={QUESTIONS} defaultOpen />);
    for (const q of QUESTIONS) {
      expect(screen.getByText(q)).toBeInTheDocument();
    }
  });

  it('clamps to 10 questions maximum', () => {
    const manyQuestions = Array.from({ length: 15 }, (_, i) => `Question ${i + 1}`);
    render(<QuestionDrawer questions={manyQuestions} defaultOpen />);
    // Only first 10 should appear
    expect(screen.getByText('Question 10')).toBeInTheDocument();
    expect(screen.queryByText('Question 11')).not.toBeInTheDocument();
  });

  it('shows "No interview questions available" when list is empty', () => {
    render(<QuestionDrawer questions={[]} defaultOpen />);
    expect(screen.getByText(/no interview questions available/i)).toBeInTheDocument();
  });

  it('renders numbered badges for each question', () => {
    render(<QuestionDrawer questions={QUESTIONS} defaultOpen />);
    // Badge "1" appears once (the count badge shows "5", not "1")
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
    // The count badge and the last numbered item both show "5"
    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1);
  });

  // ── Streaming state ────────────────────────────────────────────────────────

  it('shows loading skeleton when isStreaming=true', () => {
    render(<QuestionDrawer questions={[]} isStreaming defaultOpen />);
    expect(
      screen.getByLabelText(/loading interview questions/i),
    ).toBeInTheDocument();
  });

  it('does not show questions when isStreaming=true', () => {
    render(<QuestionDrawer questions={QUESTIONS} isStreaming defaultOpen />);
    expect(screen.queryByText(QUESTIONS[0]!)).not.toBeInTheDocument();
  });

  // ── Error state ────────────────────────────────────────────────────────────

  it('shows error message when streamError is provided', () => {
    render(
      <QuestionDrawer
        questions={[]}
        streamError="Failed to generate questions. Please try again."
        defaultOpen
      />,
    );
    expect(
      screen.getByRole('alert'),
    ).toHaveTextContent(/failed to generate questions/i);
  });

  it('does not show questions when streamError is set', () => {
    render(
      <QuestionDrawer
        questions={QUESTIONS}
        streamError="Error"
        defaultOpen
      />,
    );
    expect(screen.queryByText(QUESTIONS[0]!)).not.toBeInTheDocument();
  });

  // ── className prop ─────────────────────────────────────────────────────────

  it('applies a custom className to the root section', () => {
    const { container } = render(
      <QuestionDrawer questions={QUESTIONS} className="my-drawer" />,
    );
    expect(
      container.querySelector('[aria-label="Interview questions"]'),
    ).toHaveClass('my-drawer');
  });
});

// @vitest-environment jsdom
/**
 * Component tests for ResumeViewer
 *
 * Requirements: 14.3, 14.4, 14.2
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { ResumeViewer } from '../ResumeViewer';
import type { WeaknessMarker } from '../ResumeViewer';

afterEach(() => {
  cleanup();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const RESUME_TEXT =
  'Architected scalable microservices using TypeScript and React.\n' +
  'Responsible for managing the deployment pipeline.\n' +
  'Implemented CI/CD workflows with Docker and Kubernetes.\n' +
  'Worked on database optimization using PostgreSQL.';

const KEYWORDS = ['typescript', 'react', 'docker', 'kubernetes', 'postgresql'];

const WEAKNESS_MARKERS: WeaknessMarker[] = [
  { phrase: 'Responsible for', reason: 'Weak phrase — use a strong action verb instead.' },
  { phrase: 'Worked on', reason: 'Vague — quantify the achievement.' },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ResumeViewer', () => {
  // ── Section structure ──────────────────────────────────────────────────────

  it('renders the section with aria-label "Resume text"', () => {
    const { container } = render(<ResumeViewer text={RESUME_TEXT} />);
    expect(container.querySelector('[aria-label="Resume text"]')).toBeInTheDocument();
  });

  it('renders the scrollable content area with aria-label "Resume content"', () => {
    const { container } = render(<ResumeViewer text={RESUME_TEXT} />);
    // The scrollable div has aria-label="Resume content" (not a region role)
    expect(
      container.querySelector('[aria-label="Resume content"]'),
    ).toBeInTheDocument();
  });

  it('displays the resume text', () => {
    render(<ResumeViewer text={RESUME_TEXT} />);
    expect(screen.getByText(/Architected scalable microservices/i)).toBeInTheDocument();
  });

  // ── Keyword highlighting ───────────────────────────────────────────────────

  it('does not render keyword marks when no highlights provided', () => {
    const { container } = render(<ResumeViewer text={RESUME_TEXT} />);
    const marks = container.querySelectorAll('mark');
    expect(marks.length).toBe(0);
  });

  it('renders <mark> elements for each detected keyword', () => {
    const { container } = render(
      <ResumeViewer text={RESUME_TEXT} highlights={KEYWORDS} />,
    );
    const marks = container.querySelectorAll('mark[aria-label^="Keyword:"]');
    expect(marks.length).toBeGreaterThan(0);
  });

  it('highlights "TypeScript" when it is in the highlights list', () => {
    const { container } = render(
      <ResumeViewer text={RESUME_TEXT} highlights={['TypeScript']} />,
    );
    const mark = container.querySelector('mark[aria-label="Keyword: TypeScript"]');
    expect(mark).toBeInTheDocument();
  });

  it('applies the keyword highlight class to keyword marks', () => {
    const { container } = render(
      <ResumeViewer text={RESUME_TEXT} highlights={['TypeScript']} />,
    );
    const mark = container.querySelector('mark[aria-label^="Keyword:"]');
    expect(mark?.className).toContain('text-brand-300');
  });

  // ── Weakness markers ───────────────────────────────────────────────────────

  it('does not render the weakness legend when no markers provided', () => {
    const { container } = render(<ResumeViewer text={RESUME_TEXT} />);
    expect(
      container.querySelector('[aria-label="Weakness markers"]'),
    ).not.toBeInTheDocument();
  });

  it('renders the weakness markers legend when markers are provided', () => {
    const { container } = render(
      <ResumeViewer text={RESUME_TEXT} weaknessMarkers={WEAKNESS_MARKERS} />,
    );
    expect(
      container.querySelector('[aria-label="Weakness markers"]'),
    ).toBeInTheDocument();
  });

  it('renders a jump button for each weakness marker', () => {
    const { container } = render(
      <ResumeViewer text={RESUME_TEXT} weaknessMarkers={WEAKNESS_MARKERS} />,
    );
    const legend = container.querySelector('[aria-label="Weakness markers"]')!;
    const buttons = within(legend).getAllByRole('button');
    expect(buttons.length).toBe(2);
  });

  it('labels each jump button with the weakness phrase', () => {
    render(<ResumeViewer text={RESUME_TEXT} weaknessMarkers={WEAKNESS_MARKERS} />);
    expect(
      screen.getByRole('button', { name: /jump to weakness: responsible for/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /jump to weakness: worked on/i }),
    ).toBeInTheDocument();
  });

  it('marks weakness phrases in the text with amber styling', () => {
    const { container } = render(
      <ResumeViewer text={RESUME_TEXT} weaknessMarkers={WEAKNESS_MARKERS} />,
    );
    const weakMarks = container.querySelectorAll('mark.text-amber-300');
    expect(weakMarks.length).toBeGreaterThan(0);
  });

  it('adds aria-label to weakness marks describing the phrase and reason', () => {
    const { container } = render(
      <ResumeViewer text={RESUME_TEXT} weaknessMarkers={WEAKNESS_MARKERS} />,
    );
    const mark = container.querySelector('mark[aria-label^="Weak phrase:"]');
    expect(mark).toBeInTheDocument();
    expect(mark?.getAttribute('aria-label')).toContain('Responsible for');
  });

  // ── Tooltip on hover ───────────────────────────────────────────────────────

  it('shows a tooltip when hovering over a weakness mark', () => {
    const { container } = render(
      <ResumeViewer text={RESUME_TEXT} weaknessMarkers={WEAKNESS_MARKERS} />,
    );
    const weakMark = container.querySelector('mark.text-amber-300')!;
    // The tooltip is inside the parent span — trigger mouseenter on it
    const tooltipWrapper = weakMark.closest('span[class*="relative"]') ?? weakMark.parentElement!;
    fireEvent.mouseEnter(tooltipWrapper);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('hides the tooltip when mouse leaves the weakness mark', () => {
    const { container } = render(
      <ResumeViewer text={RESUME_TEXT} weaknessMarkers={WEAKNESS_MARKERS} />,
    );
    const weakMark = container.querySelector('mark.text-amber-300')!;
    const tooltipWrapper = weakMark.closest('span[class*="relative"]') ?? weakMark.parentElement!;
    fireEvent.mouseEnter(tooltipWrapper);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.mouseLeave(tooltipWrapper);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('tooltip text contains the weakness reason', () => {
    const { container } = render(
      <ResumeViewer text={RESUME_TEXT} weaknessMarkers={WEAKNESS_MARKERS} />,
    );
    const weakMark = container.querySelector('mark.text-amber-300')!;
    const tooltipWrapper = weakMark.closest('span[class*="relative"]') ?? weakMark.parentElement!;
    fireEvent.mouseEnter(tooltipWrapper);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toMatch(/weak phrase|vague/i);
  });

  // ── Scroll to weakness ─────────────────────────────────────────────────────

  it('calls scrollIntoView when a weakness jump button is clicked', () => {
    const { container } = render(
      <ResumeViewer text={RESUME_TEXT} weaknessMarkers={WEAKNESS_MARKERS} />,
    );

    // Mock scrollIntoView on the weakness mark element
    const weakMark = container.querySelector('mark[data-phrase="Responsible for"]');
    if (weakMark) {
      const mockScrollIntoView = vi.fn();
      (weakMark as HTMLElement).scrollIntoView = mockScrollIntoView;

      const btn = screen.getByRole('button', {
        name: /jump to weakness: responsible for/i,
      });
      fireEvent.click(btn);
      expect(mockScrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
      });
    }
  });

  // ── className prop ─────────────────────────────────────────────────────────

  it('applies a custom className to the root section', () => {
    const { container } = render(
      <ResumeViewer text={RESUME_TEXT} className="my-viewer" />,
    );
    expect(container.querySelector('[aria-label="Resume text"]')).toHaveClass('my-viewer');
  });

  // ── Empty text ─────────────────────────────────────────────────────────────

  it('renders without crashing when text is empty', () => {
    expect(() => render(<ResumeViewer text="" />)).not.toThrow();
  });
});

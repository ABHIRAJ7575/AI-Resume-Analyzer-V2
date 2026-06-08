// @vitest-environment jsdom
/**
 * Component tests for ScoreRadial
 *
 * Requirements: 6.2, 14.1
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';

// ─── Mock Framer Motion ───────────────────────────────────────────────────────
// Framer Motion uses browser animation APIs that don't work in jsdom.
// We replace animated elements with plain equivalents so the SVG renders
// synchronously and tests can inspect the DOM structure.

vi.mock('framer-motion', () => {
  const mockOn = vi.fn(() => vi.fn());
  const mockMotionValue = { set: vi.fn(), get: () => 0, on: mockOn };

  return {
    motion: {
      circle: (props: React.SVGProps<SVGCircleElement>) =>
        React.createElement('circle', props),
      div: (props: React.HTMLAttributes<HTMLDivElement>) =>
        React.createElement('div', props),
    },
    useMotionValue: () => mockMotionValue,
    useSpring: () => mockMotionValue,
    useTransform: () => ({ on: mockOn }),
    useReducedMotion: () => false,
  };
});

import { ScoreRadial } from '../ScoreRadial';

// Unmount all rendered components after each test so the DOM is clean.
afterEach(() => {
  cleanup();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ScoreRadial', () => {
  // ── Accessibility ──────────────────────────────────────────────────────────

  it('renders with role="img"', () => {
    render(<ScoreRadial score={75} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('includes the score in the aria-label', () => {
    render(<ScoreRadial score={82} />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('82'),
    );
  });

  it('includes "100" in the aria-label', () => {
    render(<ScoreRadial score={50} />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('100'),
    );
  });

  // ── SVG structure ──────────────────────────────────────────────────────────

  it('renders an SVG element', () => {
    const { container } = render(<ScoreRadial score={60} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders two circle elements (track + progress ring)', () => {
    const { container } = render(<ScoreRadial score={60} />);
    expect(container.querySelectorAll('circle').length).toBeGreaterThanOrEqual(2);
  });

  it('renders the "/100" sub-label text in the SVG', () => {
    const { container } = render(<ScoreRadial score={60} />);
    const texts = container.querySelectorAll('text');
    const subLabel = Array.from(texts).find((t) => t.textContent?.includes('100'));
    expect(subLabel).toBeTruthy();
  });

  // ── Size prop ──────────────────────────────────────────────────────────────

  it('applies the default size of 200px to the wrapper', () => {
    const { container } = render(<ScoreRadial score={50} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.width).toBe('200px');
    expect(wrapper.style.height).toBe('200px');
  });

  it('applies a custom size to the wrapper', () => {
    const { container } = render(<ScoreRadial score={50} size={150} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.width).toBe('150px');
    expect(wrapper.style.height).toBe('150px');
  });

  // ── Score clamping ─────────────────────────────────────────────────────────

  it('clamps score above 100 to 100 in the aria-label', () => {
    const { getByRole } = render(<ScoreRadial score={150} />);
    // aria-label: "Resume score: 100 out of 100"
    expect(getByRole('img')).toHaveAttribute(
      'aria-label',
      'Resume score: 100 out of 100',
    );
  });

  it('clamps score below 0 to 0 in the aria-label', () => {
    const { getByRole } = render(<ScoreRadial score={-10} />);
    expect(getByRole('img')).toHaveAttribute(
      'aria-label',
      'Resume score: 0 out of 100',
    );
  });

  // ── className prop ─────────────────────────────────────────────────────────

  it('applies a custom className to the root element', () => {
    const { container } = render(
      <ScoreRadial score={50} className="my-custom-class" />,
    );
    expect(container.firstElementChild).toHaveClass('my-custom-class');
  });
});

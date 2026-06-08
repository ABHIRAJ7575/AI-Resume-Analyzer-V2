'use client';

/**
 * MagneticWrapper — applies a subtle magnetic pull effect to its children
 * when the cursor hovers nearby.
 *
 * Uses Framer Motion's useMotionValue + useSpring to track cursor position
 * and translate the element toward the cursor with spring physics.
 *
 * Performance: uses CSS `transform: translate` via Framer Motion's style prop,
 * which is GPU-composited and avoids layout thrashing. `will-change: transform`
 * is applied to promote the element to its own compositor layer.
 *
 * Accessibility: respects `prefers-reduced-motion` — when the user has
 * requested reduced motion, the magnetic effect is disabled entirely.
 *
 * Requirements: 6.5, 6.6
 */

import { useRef, useCallback } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';

export interface MagneticWrapperProps {
  children: React.ReactNode;
  /** Strength of the magnetic pull (0–1). Default: 0.3. */
  strength?: number;
  className?: string;
}

const SPRING = { stiffness: 200, damping: 20, mass: 0.5 };

export function MagneticWrapper({
  children,
  strength = 0.3,
  className = '',
}: MagneticWrapperProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, SPRING);
  const springY = useSpring(y, SPRING);

  // Respect the user's reduced-motion preference (WCAG 2.3.3).
  const prefersReducedMotion = useReducedMotion();

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!ref.current || prefersReducedMotion) return;
      const rect = ref.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      x.set((e.clientX - cx) * strength);
      y.set((e.clientY - cy) * strength);
    },
    [x, y, strength, prefersReducedMotion],
  );

  const handleMouseLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return (
    <motion.div
      ref={ref}
      // CSS transform (translateX/translateY) — GPU-composited, no layout thrashing.
      style={{
        x: prefersReducedMotion ? 0 : springX,
        y: prefersReducedMotion ? 0 : springY,
        // Promote to compositor layer to avoid triggering layout/paint on siblings.
        willChange: 'transform',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
    >
      {children}
    </motion.div>
  );
}

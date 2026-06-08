'use client';

import { useEffect, useRef } from 'react';

export function VectorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;

    canvas.width = width;
    canvas.height = height;

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener('resize', handleResize);

    // Pointer tracking with spring physics
    const targetPointer = { x: width / 2, y: height / 2, active: false, lastMoveTime: 0 };
    const springPointer = { x: width / 2, y: height / 2 };

    const updateTargetPointer = (x: number, y: number) => {
      targetPointer.x = x;
      targetPointer.y = y;
      targetPointer.active = true;
      targetPointer.lastMoveTime = Date.now();
    };

    const handlePointerMove = (e: PointerEvent) => updateTargetPointer(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) updateTargetPointer(e.touches[0]!.clientX, e.touches[0]!.clientY);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchstart', handleTouchMove, { passive: true });

    const TOKENS = ['W₁', 'b₁', '[0.992]', 'f(x)', 'σ(z)', '∇L', '(data)', 'RAG', 'ATS'];

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      token: string;
      currentOpacity: number;
      targetOpacity: number;
      fontSize: number;
      depth: number;

      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.25;
        this.vy = (Math.random() - 0.5) * 0.25;
        this.token = TOKENS[Math.floor(Math.random() * TOKENS.length)]!;
        this.currentOpacity = 0.12;
        this.targetOpacity = 0.12;
        this.depth = Math.random() * 0.5 + 0.5; // Parallax multiplier
        this.fontSize = 11 * this.depth + 4;
      }

      update(isOrbiting: boolean, cx: number, cy: number) {
        const dx = this.x - cx;
        const dy = this.y - cy;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 150) {
          this.targetOpacity = 0.95;
          if (isOrbiting) {
            // Intense AI reading data vibe: Revolving Orbit
            let currentAngle = Math.atan2(dy, dx);
            currentAngle += 0.05 * (this.depth + 1); // Speed up based on depth
            const orbitRadius = Math.max(30, distance * 0.98); // Slowly pull into vortex
            
            const targetX = cx + Math.cos(currentAngle) * orbitRadius;
            const targetY = cy + Math.sin(currentAngle) * orbitRadius;
            
            this.x += (targetX - this.x) * 0.15;
            this.y += (targetY - this.y) * 0.15;
          } else {
            this.x += this.vx * this.depth;
            this.y += this.vy * this.depth;
          }
        } else {
          this.targetOpacity = 0.12;
          this.x += this.vx * this.depth;
          this.y += this.vy * this.depth;
        }

        // Interpolate opacity for graceful fade
        this.currentOpacity += (this.targetOpacity - this.currentOpacity) * 0.08;

        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        if (this.y > height) this.y = 0;
      }

      draw(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = `rgba(148, 163, 184, ${this.currentOpacity})`;
        ctx.font = `${this.fontSize}px "Inter", monospace`;
        ctx.fillText(this.token, this.x, this.y);
      }
    }

    const particles: Particle[] = [];
    const numParticles = Math.min(120, Math.floor((width * height) / 12000));
    for (let i = 0; i < numParticles; i++) {
      particles.push(new Particle());
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Spring physics for pointer
      if (targetPointer.active) {
        springPointer.x += (targetPointer.x - springPointer.x) * 0.15;
        springPointer.y += (targetPointer.y - springPointer.y) * 0.15;
      }

      particles.forEach((p) => {
        p.update(targetPointer.active, springPointer.x, springPointer.y);
        p.draw(ctx);

        if (targetPointer.active) {
          const dx = p.x - springPointer.x;
          const dy = p.y - springPointer.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(springPointer.x, springPointer.y);
            ctx.strokeStyle = `rgba(148, 163, 184, 0.15)`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchstart', handleTouchMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-80"
    />
  );
}

'use client';

import { motion } from 'motion/react';

interface CenteredShellProps {
  children: React.ReactNode; // flex-column: header shrink-0 / content flex-1 overflow / nav shrink-0
  prefersReducedMotion: boolean;
}

export function CenteredShell({ children, prefersReducedMotion }: CenteredShellProps) {
  return (
    <div className="relative min-h-dvh bg-[var(--color-bg-primary)] overflow-hidden flex items-stretch md:items-center justify-center md:p-6 lg:p-8">
      {/* Decorative ambient orbs */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute top-[-120px] right-[-100px] w-96 h-96 rounded-full opacity-[0.18] blur-3xl z-0"
        style={{
          background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)',
          willChange: 'transform',
        }}
        animate={
          prefersReducedMotion
            ? undefined
            : { x: [0, 24, 0], y: [0, -18, 0] }
        }
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-100px] left-[-80px] w-[480px] h-[480px] rounded-full opacity-[0.14] blur-3xl z-0"
        style={{
          background: 'radial-gradient(circle, var(--color-secondary) 0%, transparent 70%)',
          willChange: 'transform',
        }}
        animate={
          prefersReducedMotion
            ? undefined
            : { x: [0, -16, 0], y: [0, 22, 0] }
        }
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute top-[45%] left-[15%] w-64 h-64 rounded-full opacity-[0.10] blur-2xl z-0"
        style={{
          background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)',
          willChange: 'transform',
        }}
        animate={
          prefersReducedMotion
            ? undefined
            : { x: [0, 12, 0], y: [0, -12, 0] }
        }
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Atmospheric grain texture */}
      <div aria-hidden="true" className="grain-overlay pointer-events-none z-0" />

      {/* Elevated glass card */}
      <motion.div
        className={[
          'relative z-10 w-full flex flex-col',
          // Mobile: full-bleed, no rounding
          'min-h-dvh max-w-md mx-auto bg-[var(--color-bg-card)]',
          // md+: floating glass card
          'md:min-h-0 md:h-auto md:max-h-[92dvh] md:max-w-2xl lg:max-w-3xl',
          'md:rounded-[28px] md:border md:border-[var(--color-border)]',
          'md:shadow-glow md:glass md:overflow-hidden',
        ].join(' ')}
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98, y: 10 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
}

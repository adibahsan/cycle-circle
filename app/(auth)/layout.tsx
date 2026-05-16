'use client';

import { motion } from 'motion/react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row relative overflow-hidden bg-[var(--color-bg-primary)]">
      {/* ── Desktop left panel: branding / illustration (md+) ── */}
      <div className="hidden md:flex md:w-1/2 lg:w-[55%] relative items-center justify-center overflow-hidden">
        {/* Decorative blobs for left panel */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -right-16 w-80 h-80 rounded-full opacity-25"
          style={{
            background: 'radial-gradient(circle, var(--color-secondary) 0%, transparent 70%)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)',
          }}
        />
        {/* Dot grid */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'radial-gradient(circle, var(--color-text-primary) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Branding content */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 px-12 lg:px-16 max-w-lg"
        >
          <h1 className="text-5xl lg:text-6xl font-bold gradient-primary bg-clip-text text-transparent mb-4">
            Vesta
          </h1>
          <p className="text-lg lg:text-xl text-[var(--color-text-secondary)] leading-relaxed mb-6">
            Smart cycle tracking with predictive insights. Understand your body, plan your life.
          </p>
          <div className="flex gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
              <span className="text-sm">🩸</span>
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Period Tracking</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
              <span className="text-sm">🌸</span>
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Predictions</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
              <span className="text-sm">📊</span>
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Insights</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Right panel / mobile full-screen: auth form ── */}
      <div className="flex-1 flex flex-col items-center justify-center relative min-h-screen md:min-h-0 md:border-l md:border-[var(--color-border)]">
        {/* Mobile-only decorative blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -left-32 w-80 h-80 rounded-full opacity-25 md:opacity-10"
          style={{
            background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -right-24 w-72 h-72 rounded-full opacity-20 md:opacity-10"
          style={{
            background: 'radial-gradient(circle, var(--color-secondary) 0%, transparent 70%)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-10 md:hidden"
          style={{
            background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)',
          }}
        />

        {/* Subtle dot-grid pattern */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'radial-gradient(circle, var(--color-text-primary) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Content container */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-sm px-4 py-8 md:px-8 md:max-w-md"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

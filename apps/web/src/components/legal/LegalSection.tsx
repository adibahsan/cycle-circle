'use client';

import type React from 'react';
import { RevealOnScroll } from '@/components/motion/RevealOnScroll';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LegalSectionProps {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LegalSection({ icon: Icon, title, children }: LegalSectionProps) {
  return (
    <RevealOnScroll>
      <div className="glass rounded-2xl shadow-soft p-5 sm:p-6 space-y-3">
        {/* Header row */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-action)] flex items-center justify-center shrink-0">
            <Icon size={16} className="text-[var(--color-on-action)]" aria-hidden="true" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-[var(--color-text-primary)]">
            {title}
          </h2>
        </div>

        {/* Body */}
        <div className="space-y-2 text-sm sm:text-[15px] text-[var(--color-text-secondary)] leading-relaxed">
          {children}
        </div>
      </div>
    </RevealOnScroll>
  );
}

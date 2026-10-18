'use client';

import type React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { LandingFooter } from '@/app/(marketing)/welcome/sections/LandingFooter';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LegalPageShellProps {
  title: string;
  dateLabel: string;
  intro: string;
  children: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LegalPageShell({ title, dateLabel, intro, children }: LegalPageShellProps) {
  const { t } = useTranslation();

  return (
    <div className="relative min-h-dvh bg-[var(--color-bg-primary)]">
      {/* Decorative grain overlay */}
      <div aria-hidden="true" className="grain-overlay" />

      {/* ── Slim sticky header ── */}
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] backdrop-blur-md bg-[var(--color-bg-primary)]/80">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <Link
            href="/"
            aria-label={t('app.name')}
            className="inline-flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)] rounded-xl"
          >
            <BrandLogo size={36} alt="" />
            <span className="font-extrabold text-[var(--color-text-primary)] text-lg">
              {t('app.name')}
            </span>
          </Link>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="relative z-10 max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <h1 className="text-fluid-xl font-bold text-[var(--color-text-primary)]">{title}</h1>
        <p
          className="mt-1.5 text-sm text-[var(--color-text-muted)]"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {dateLabel}
        </p>
        <p className="mt-4 text-sm sm:text-base text-[var(--color-text-secondary)] leading-relaxed max-w-2xl">
          {intro}
        </p>

        <div className="mt-8 space-y-4">{children}</div>
      </main>

      {/* ── Footer ── */}
      <LandingFooter />
    </div>
  );
}

'use client';

import { useTranslation } from 'react-i18next';
import { LANDING_CONTAINER, LANDING_SECTION } from './landing-layout';
import { RevealOnScroll } from '@/components/motion/RevealOnScroll';

/** A typical 28-day cycle; each arc is drawn proportional to its days. */
const PHASES = [
  { labelKey: 'dashboard.menstrual', colorVar: '--color-menstrual', days: 5 },
  { labelKey: 'dashboard.follicular', colorVar: '--color-follicular', days: 8 },
  { labelKey: 'dashboard.ovulation', colorVar: '--color-ovulation', days: 2 },
  { labelKey: 'dashboard.luteal', colorVar: '--color-luteal', days: 13 },
] as const;

const TOTAL = PHASES.reduce((n, p) => n + p.days, 0);
const R = 70;
const C = 2 * Math.PI * R;
const GAP = 4;

/** Each arc's length and where it starts along the ring, computed once. */
const ARCS = PHASES.map((p, i) => ({
  colorVar: p.colorVar,
  len: (p.days / TOTAL) * C,
  start: (PHASES.slice(0, i).reduce((n, q) => n + q.days, 0) / TOTAL) * C,
}));

function CycleRing() {
  return (
    <svg viewBox="0 0 180 180" className="w-44 h-44 sm:w-52 sm:h-52 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="90" cy="90" r={R} fill="none" stroke="var(--color-border)" strokeWidth="18" />
      {ARCS.map(({ colorVar, len, start }) => (
        <circle
          key={colorVar}
          cx="90"
          cy="90"
          r={R}
          fill="none"
          stroke={`var(${colorVar})`}
          strokeWidth="18"
          strokeDasharray={`${Math.max(len - GAP, 1)} ${C}`}
          strokeDashoffset={-start}
        />
      ))}
    </svg>
  );
}

export function PhaseShowcaseSection() {
  const { t } = useTranslation();

  return (
    <section
      className={LANDING_SECTION}
      aria-labelledby="phases-heading"
    >
      <div className={LANDING_CONTAINER}>
        <RevealOnScroll>
          <div className="flex flex-col sm:flex-row items-center gap-8 sm:gap-14">
            <CycleRing />
            <div className="w-full sm:w-auto">
              <h2
                id="phases-heading"
                className="text-fluid-md font-bold text-[var(--color-text-primary)] mb-4"
              >
                {t('dashboard.cycleOverview')}
              </h2>
              <ul className="grid grid-cols-2 gap-x-8 gap-y-3">
                {PHASES.map(({ labelKey, colorVar }) => (
                  <li key={labelKey} className="flex items-center gap-2.5 text-[var(--color-text-secondary)] font-medium capitalize">
                    <span aria-hidden="true" className="w-3 h-3 rounded-full shrink-0" style={{ background: `var(${colorVar})` }} />
                    {t(labelKey)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}

'use client';

import '@vesta/shared/utils/i18n';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  ChevronRight,
  CalendarHeart,
  Sparkles,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { useHasMounted } from '@/components/motion/useHasMounted';

// ─── Animation constants ───────────────────────────────────────────────────────

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const FADE_UP = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.42, ease: EASE },
  }),
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

interface Feature {
  key: string;
  Icon: LucideIcon;
  accent: string;
}

const FEATURES = [
  { key: 'tracking', Icon: CalendarHeart, accent: '--color-menstrual' },
  { key: 'predictions', Icon: Sparkles, accent: '--color-follicular' },
  { key: 'privacy', Icon: ShieldCheck, accent: '--color-ovulation' },
  { key: 'profiles', Icon: Users, accent: '--color-luteal' },
] as const satisfies readonly Feature[];

// ─── Progress dots ────────────────────────────────────────────────────────────

function ProgressDots({
  step,
  prefersReducedMotion,
}: {
  step: number;
  prefersReducedMotion: boolean;
}) {
  return (
    <div
      className="flex items-center gap-1.5 justify-center"
      aria-label={`Step ${step} of ${TOTAL_STEPS}`}
    >
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const isActive = i + 1 === step;
        return (
          <motion.div
            key={i}
            initial={false}
            animate={
              prefersReducedMotion
                ? {
                    width: isActive ? 24 : 8,
                    backgroundColor:
                      i + 1 <= step
                        ? 'var(--color-primary)'
                        : 'var(--color-border)',
                    scale: 1,
                  }
                : {
                    width: isActive ? 24 : 8,
                    backgroundColor:
                      i + 1 <= step
                        ? 'var(--color-primary)'
                        : 'var(--color-border)',
                    scale: isActive ? [1, 1.2, 1] : 1,
                  }
            }
            transition={
              prefersReducedMotion
                ? { duration: 0.3 }
                : isActive
                  ? {
                      width: { duration: 0.3 },
                      backgroundColor: { duration: 0.3 },
                      scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                    }
                  : { duration: 0.3 }
            }
            className="h-2 rounded-full"
          />
        );
      })}
    </div>
  );
}

// ─── Feature illustration ─────────────────────────────────────────────────────

function FeatureIllustration({
  accent,
  Icon,
  prefersReducedMotion,
}: {
  accent: string;
  Icon: LucideIcon;
  prefersReducedMotion: boolean;
}) {
  const accentVar = `var(${accent})`;

  return (
    <motion.div
      custom={0}
      variants={FADE_UP}
      initial={prefersReducedMotion ? false : 'hidden'}
      animate="show"
      className="relative w-56 h-56 flex items-center justify-center mt-4"
    >
      {/* Outermost ring */}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full animate-breathe"
        style={{
          background: `radial-gradient(circle, color-mix(in srgb, ${accentVar} 10%, transparent), color-mix(in srgb, ${accentVar} 5%, transparent))`,
          boxShadow: `0 0 0 1px color-mix(in srgb, ${accentVar} 15%, transparent)`,
        }}
      />
      {/* Middle ring */}
      <div
        aria-hidden="true"
        className="absolute inset-6 rounded-full animate-breathe"
        style={{
          background: `radial-gradient(circle, color-mix(in srgb, ${accentVar} 15%, transparent), color-mix(in srgb, ${accentVar} 8%, transparent))`,
          animationDelay: '0.4s',
        }}
      />
      {/* Inner ring */}
      <div
        aria-hidden="true"
        className="absolute inset-12 rounded-full"
        style={{
          background: `radial-gradient(circle, color-mix(in srgb, ${accentVar} 25%, transparent), color-mix(in srgb, ${accentVar} 15%, transparent))`,
        }}
      />
      {/* Floating accent dots */}
      <div
        aria-hidden="true"
        className="absolute top-3 right-8 w-5 h-5 rounded-full animate-float"
        style={{ backgroundColor: `color-mix(in srgb, ${accentVar} 60%, transparent)` }}
      />
      <div
        aria-hidden="true"
        className="absolute bottom-6 left-5 w-4 h-4 rounded-full animate-float"
        style={{
          backgroundColor: `color-mix(in srgb, ${accentVar} 50%, transparent)`,
          animationDelay: '0.6s',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute top-10 left-4 w-3 h-3 rounded-full animate-float"
        style={{
          backgroundColor: `color-mix(in srgb, ${accentVar} 40%, transparent)`,
          animationDelay: '1.1s',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute bottom-10 right-3 w-3 h-3 rounded-full animate-float"
        style={{
          backgroundColor: `color-mix(in srgb, ${accentVar} 35%, transparent)`,
          animationDelay: '1.7s',
        }}
      />
      {/* Center icon circle */}
      <div
        className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${accentVar}, color-mix(in srgb, ${accentVar} 70%, var(--color-primary)))`,
          boxShadow: `0 8px 32px color-mix(in srgb, ${accentVar} 35%, transparent)`,
        }}
      >
        <Icon size={36} className="text-white" aria-hidden="true" />
      </div>
    </motion.div>
  );
}

// ─── Feature screen (steps 1–4) ───────────────────────────────────────────────

function FeatureScreen({
  feature,
  prefersReducedMotion,
}: {
  feature: Feature;
  prefersReducedMotion: boolean;
}) {
  const { t } = useTranslation();
  const { key, Icon, accent } = feature;

  return (
    <div className="flex flex-col items-center text-center gap-8 px-2 min-h-[60dvh] justify-center">
      <FeatureIllustration
        accent={accent}
        Icon={Icon}
        prefersReducedMotion={prefersReducedMotion}
      />

      <motion.div
        custom={1}
        variants={FADE_UP}
        initial={prefersReducedMotion ? false : 'hidden'}
        animate="show"
        className="space-y-3 max-w-sm"
      >
        <h1 className="text-fluid-lg font-bold text-[var(--color-text-primary)]">
          {t(`landing.features.${key}.title`)}
        </h1>
        <p className="text-fluid-md text-[var(--color-text-secondary)] max-w-md leading-relaxed">
          {t(`landing.features.${key}.body`)}
        </p>
      </motion.div>
    </div>
  );
}

// ─── Final screen (step 5) ────────────────────────────────────────────────────

function FinalScreen({ prefersReducedMotion }: { prefersReducedMotion: boolean }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center text-center gap-8 px-2 min-h-[60dvh] justify-center">
      {/* Decorative gradient panel */}
      <motion.div
        custom={0}
        variants={FADE_UP}
        initial={prefersReducedMotion ? false : 'hidden'}
        animate="show"
        className="gradient-primary rounded-[var(--radius-xl)] shadow-glow px-8 py-10 flex flex-col items-center gap-6 w-full max-w-sm"
      >
        <h1 className="text-fluid-xl font-bold text-white">
          {t('getStarted.finalTitle')}
        </h1>
        <p className="text-fluid-md text-white/80 max-w-sm leading-relaxed">
          {t('getStarted.finalSubtitle')}
        </p>
        <Link href="/login">
          <Button
            variant="secondary"
            size="lg"
            className="rounded-2xl font-bold min-w-[180px] bg-white text-[var(--color-primary)] hover:bg-white/90 border-0 shadow-soft"
          >
            {t('getStarted.finalCta')}
          </Button>
        </Link>
      </motion.div>

      <motion.div
        custom={1}
        variants={FADE_UP}
        initial={prefersReducedMotion ? false : 'hidden'}
        animate="show"
      >
        <Link
          href="/login"
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 rounded"
        >
          {t('getStarted.haveAccount')}
        </Link>
      </motion.div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GetStartedClient() {
  const { t } = useTranslation();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<1 | -1>(1);

  // Reduced-motion gate: server and first client render always agree (animated);
  // only after mount do we read the OS preference and suppress motion.
  const reduceRaw = useReducedMotion() ?? false;
  const mounted = useHasMounted();
  const prefersReducedMotion = mounted && reduceRaw;

  const goNext = useCallback(() => {
    setDirection(1);
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(1, s - 1));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goBack();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goBack]);

  // Direction-aware slide variants — x offsets collapse to 0 when reduced motion preferred
  const variants = {
    enter: (dir: number) => ({
      x: prefersReducedMotion ? 0 : dir > 0 ? '60%' : '-60%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: prefersReducedMotion ? 0 : dir > 0 ? '-60%' : '60%',
      opacity: 0,
    }),
  };

  function renderStep() {
    if (step >= 1 && step <= 4) {
      return (
        <FeatureScreen
          feature={FEATURES[step - 1]}
          prefersReducedMotion={prefersReducedMotion}
        />
      );
    }
    return <FinalScreen prefersReducedMotion={prefersReducedMotion} />;
  }

  return (
    <div className="min-h-dvh bg-[var(--color-bg-primary)] flex flex-col max-w-md mx-auto relative overflow-hidden">
      {/* Floating background orbs — stopped when reduced motion is preferred */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute top-[-80px] right-[-60px] w-72 h-72 rounded-full opacity-[0.08]"
        style={{ background: 'radial-gradient(circle, #e8476c 0%, transparent 70%)' }}
        animate={prefersReducedMotion ? undefined : { x: [0, 20, 0], y: [0, -15, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-60px] left-[-80px] w-80 h-80 rounded-full opacity-[0.08]"
        style={{ background: 'radial-gradient(circle, #9b7fd4 0%, transparent 70%)' }}
        animate={prefersReducedMotion ? undefined : { x: [0, -12, 0], y: [0, 18, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-[var(--color-bg-primary)]/90 backdrop-blur-sm px-5 pt-safe-top">
        <div className="flex items-center justify-between py-4">
          {/* Vesta wordmark */}
          <span className="text-lg font-bold text-[var(--color-primary)]">
            {t('app.name')}
          </span>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            {/* Skip link — takes logged-out user straight to login */}
            <Link
              href="/login"
              aria-label={t('getStarted.skip')}
              className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 rounded"
            >
              {t('getStarted.skip')}
            </Link>
            {/* Step counter */}
            <span className="text-xs font-medium text-[var(--color-text-muted)] tabular-nums">
              {step}&nbsp;/&nbsp;{TOTAL_STEPS}
            </span>
          </div>
        </div>
        {/* Progress dots */}
        <ProgressDots step={step} prefersReducedMotion={prefersReducedMotion} />
        <div className="pb-2" />
      </div>

      {/* Step content with animated slide transitions */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={
              prefersReducedMotion
                ? { opacity: { duration: 0.15 } }
                : {
                    x: { type: 'spring', stiffness: 280, damping: 30 },
                    opacity: { duration: 0.18 },
                  }
            }
            className="absolute inset-0 overflow-y-auto px-5 py-4"
          >
            {renderStep()}
            {/* Bottom padding so content isn't hidden behind fixed nav */}
            <div className="h-6" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Sticky bottom navigation */}
      <div className="sticky bottom-0 z-20 bg-[var(--color-bg-primary)]/95 backdrop-blur-sm border-t border-[var(--color-border)] px-5 py-4">
        <div className="flex gap-3 max-w-md mx-auto">
          {/* Back button — hidden on step 1 */}
          <Button
            variant="outline"
            size="lg"
            onClick={goBack}
            aria-label={t('common.back')}
            className="w-14 shrink-0 px-0"
            disabled={step === 1}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </Button>

          {/* Next button — hidden on step 5 where the CTA is in content */}
          {step < TOTAL_STEPS && (
            <Button size="lg" fullWidth onClick={goNext} aria-label={t('common.next')}>
              {t('getStarted.next')}&nbsp;
              <ChevronRight size={18} className="ml-1" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

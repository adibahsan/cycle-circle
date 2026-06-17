'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { HeartHandshake } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { useHasMounted } from '@/components/motion/useHasMounted';
import { goalAccentVar } from '@vesta/shared/utils/goal';
import '@vesta/shared/utils/i18n';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface LatePeriodFullScreenAlertProps {
  open: boolean;
  onClose: () => void;
  daysLate: number;
  goal: string | null;
  onLogPeriod: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LatePeriodFullScreenAlert({
  open,
  onClose,
  daysLate,
  goal,
  onLogPeriod,
}: LatePeriodFullScreenAlertProps) {
  const { t } = useTranslation();
  const mounted = useHasMounted();
  const reduceRaw = useReducedMotion() ?? false;
  const prefersReducedMotion = mounted && reduceRaw;

  const accentVar = goalAccentVar(goal);
  // Used to focus the primary CTA on open (wraps the button since Button lacks forwardRef)
  const ctaWrapperRef = useRef<HTMLDivElement>(null);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Body scroll lock while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Focus the primary CTA button on open
  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => {
        const btn = ctaWrapperRef.current?.querySelector<HTMLButtonElement>('button');
        btn?.focus();
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [open]);

  function handleLogPeriod() {
    onClose();
    onLogPeriod();
  }

  // Overlay animation — gated by reduced motion
  const overlayInitial = { opacity: 0 };
  const overlayAnimate = { opacity: 1 };
  const overlayExit = { opacity: 0 };
  const overlayTransition = prefersReducedMotion
    ? { duration: 0.15 }
    : { duration: 0.25, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] };

  // Content entrance — gated by reduced motion
  const contentInitial = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, y: '4%' };
  const contentAnimate = prefersReducedMotion
    ? { opacity: 1 }
    : { opacity: 1, y: 0 };
  const contentExit = prefersReducedMotion
    ? { opacity: 0, transition: { duration: 0.12 } }
    : { opacity: 0, y: '4%', transition: { duration: 0.18, ease: [0.4, 0, 1, 1] as [number, number, number, number] } };
  const contentTransition = prefersReducedMotion
    ? { duration: 0.15 }
    : { type: 'spring' as const, damping: 28, stiffness: 280, delay: 0.08 };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] overscroll-contain"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="late-alert-title"
          aria-describedby="late-alert-desc"
          style={
            {
              ['--goal-accent']: accentVar,
              background: 'color-mix(in srgb, var(--goal-accent) 14%, var(--color-bg-primary))',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            } as React.CSSProperties
          }
          initial={overlayInitial}
          animate={overlayAnimate}
          exit={overlayExit}
          transition={overlayTransition}
        >
          {/* Centered content column */}
          <motion.div
            className="flex min-h-screen flex-col items-center justify-center text-center px-6"
            initial={contentInitial}
            animate={contentAnimate}
            exit={contentExit}
            transition={contentTransition}
          >
            <div className="flex flex-col items-center gap-5 max-w-sm mx-auto w-full">

              {/* Icon badge */}
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: 'color-mix(in srgb, var(--goal-accent) 16%, transparent)',
                }}
                aria-hidden="true"
              >
                {prefersReducedMotion || !mounted ? (
                  <HeartHandshake
                    size={34}
                    aria-hidden="true"
                    style={{ color: 'var(--goal-accent)' }}
                  />
                ) : (
                  <motion.span
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 18, stiffness: 280, delay: 0.15 }}
                    className="flex items-center justify-center"
                    style={{ willChange: 'transform, opacity' } as React.CSSProperties}
                  >
                    {/* Subtle breathe loop */}
                    <motion.span
                      animate={{ scale: [1, 1.07, 1] }}
                      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                      className="flex items-center justify-center"
                    >
                      <HeartHandshake
                        size={34}
                        aria-hidden="true"
                        style={{ color: 'var(--goal-accent)' }}
                      />
                    </motion.span>
                  </motion.span>
                )}
              </div>

              {/* Title */}
              <h1
                id="late-alert-title"
                className="text-2xl font-bold text-[var(--color-text-primary)] leading-snug"
              >
                {t('latePeriod.title')}
              </h1>

              {/* Body */}
              <p
                id="late-alert-desc"
                className="text-base text-[var(--color-text-secondary)] max-w-xs leading-relaxed"
              >
                {t('latePeriod.body', { count: daysLate })}
              </p>

              {/* Actions */}
              <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
                {/* Primary CTA — wrapper div carries ref for focus management */}
                <div ref={ctaWrapperRef}>
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={handleLogPeriod}
                  className="focus-visible:ring-[var(--goal-accent)]"
                  style={
                    {
                      background: 'var(--goal-accent)',
                      borderColor: 'var(--goal-accent)',
                    } as React.CSSProperties
                  }
                >
                  {t('latePeriod.logCta')}
                </Button>
                </div>

                {/* Ghost / dismiss CTA */}
                <Button
                  variant="ghost"
                  size="lg"
                  fullWidth
                  onClick={onClose}
                  className="focus-visible:ring-[var(--goal-accent)]"
                >
                  {t('latePeriod.later')}
                </Button>
              </div>

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

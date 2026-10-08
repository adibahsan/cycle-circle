'use client';

import { useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useHasMounted } from '@/components/motion/useHasMounted';
import { Modal } from '@/components/ui/Modal';
import { goalAccentVar } from '@vesta/shared/utils/goal';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CelebrationModalProps {
  open: boolean;
  onClose: () => void;
  goal: string | null;
  kind: 'period' | 'symptom' | 'streak' | 'milestone';
  count?: number;
  autoCloseMs?: number; // default 2600; 0 disables auto-close
}

// ─── Confetti dots ─────────────────────────────────────────────────────────────

const confettiDots = [
  { top: '8%', left: '10%', color: 'var(--color-primary)', size: 10, delay: '0s' },
  { top: '5%', left: '80%', color: 'var(--color-secondary)', size: 8, delay: '0.1s' },
  { top: '15%', left: '55%', color: 'var(--color-accent)', size: 6, delay: '0.2s' },
  { top: '3%', left: '35%', color: 'var(--color-primary)', size: 7, delay: '0.15s' },
  { top: '12%', left: '92%', color: 'var(--color-accent)', size: 9, delay: '0.05s' },
  { top: '20%', left: '5%', color: 'var(--color-secondary)', size: 5, delay: '0.25s' },
  { top: '18%', left: '70%', color: 'var(--color-primary)', size: 6, delay: '0.3s' },
  { top: '6%', left: '20%', color: 'var(--color-accent)', size: 8, delay: '0.08s' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function CelebrationModal({
  open,
  onClose,
  goal,
  kind,
  count,
  autoCloseMs = 2600,
}: CelebrationModalProps) {
  const { t } = useTranslation();
  const mounted = useHasMounted();
  const reduceRaw = useReducedMotion() ?? false;
  const prefersReducedMotion = mounted && reduceRaw;

  const accentVar = goalAccentVar(goal);

  // Auto-dismiss
  useEffect(() => {
    if (!open || autoCloseMs <= 0) return;
    const id = setTimeout(onClose, autoCloseMs);
    return () => clearTimeout(id);
  }, [open, autoCloseMs, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId="celebration-title"
      accentVar={accentVar}
      closeOnBackdrop
      hideClose
      panelClassName="text-center"
    >
      {/* Set --goal-accent scoped to content root */}
      <div
        style={{ '--goal-accent': accentVar } as React.CSSProperties}
        className="px-6 pb-8 pt-4 flex flex-col items-center gap-5"
      >
        {/* Confetti + icon header */}
        <div
          className="relative w-full h-28 flex items-center justify-center"
          aria-hidden="true"
        >
          {/* Confetti dots */}
          {confettiDots.map((dot, i) =>
            prefersReducedMotion ? (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  top: dot.top,
                  left: dot.left,
                  width: dot.size,
                  height: dot.size,
                  backgroundColor: dot.color,
                  opacity: 0.6,
                }}
              />
            ) : (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: -20, scale: 0 }}
                animate={{ opacity: [0, 1, 0.6, 1], y: [-20, 0, -18, 0], scale: [0, 1, 1, 1] }}
                transition={{
                  delay: parseFloat(dot.delay),
                  duration: 3 + i * 0.4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  times: [0, 0.15, 0.57, 1],
                }}
                className="absolute rounded-full"
                style={{
                  top: dot.top,
                  left: dot.left,
                  width: dot.size,
                  height: dot.size,
                  backgroundColor: dot.color,
                }}
              />
            )
          )}

          {/* Central icon badge */}
          <motion.div
            initial={prefersReducedMotion ? false : { scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={
              prefersReducedMotion
                ? undefined
                : { type: 'spring', stiffness: 260, damping: 18 }
            }
            className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center"
            style={{
              background: 'var(--goal-accent)',
              boxShadow: '0 8px 40px color-mix(in srgb, var(--goal-accent) 35%, transparent)',
            }}
          >
            <CheckCircle size={40} className="text-[var(--color-on-accent)]" strokeWidth={2.5} aria-hidden="true" />
          </motion.div>
        </div>

        {/* Text content */}
        <div className="space-y-2">
          <h2
            id="celebration-title"
            className="text-xl font-bold text-[var(--color-text-primary)]"
          >
            {kind === 'period'
              ? t('celebration.periodTitle')
              : kind === 'symptom'
                ? t('celebration.symptomTitle')
                : kind === 'milestone'
                  ? t('celebration.milestoneTitle', { count: count ?? 0 })
                  : t('celebration.streakTitle', { count: count ?? 0 })}
          </h2>

          <p
            className="text-[var(--color-text-secondary)] text-sm"
            aria-live="polite"
          >
            {kind === 'period'
              ? t('celebration.periodBody')
              : kind === 'symptom'
                ? t('celebration.symptomBody', { count: count ?? 0 })
                : kind === 'milestone'
                  ? t('celebration.milestoneBody', { count: count ?? 0 })
                  : t('celebration.streakBody', { count: count ?? 0 })}
          </p>
        </div>

        {/* Done button */}
        <button
          onClick={onClose}
          className="mt-1 px-8 py-2.5 rounded-xl text-sm font-semibold text-[var(--color-on-accent)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={
            {
              background: 'var(--goal-accent)',
              '--tw-ring-color': 'color-mix(in srgb, var(--goal-accent) 50%, transparent)',
              '--tw-ring-offset-color': 'var(--color-bg-card)',
            } as React.CSSProperties
          }
        >
          {t('celebration.close')}
        </button>
      </div>
    </Modal>
  );
}

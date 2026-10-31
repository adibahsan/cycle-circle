'use client';

/**
 * Shared toast. Mount `<ToastProvider>` once (the main layout does); then:
 *
 *   import { useToast } from '@/components/ui/Toast';
 *   const toast = useToast();
 *   toast.show('Saved');                       // plain, immediate
 *   toast.celebrate('period');                 // celebration copy + confetti, after the pop-up has closed
 *   toast.celebrate('symptom', savedCount);
 *
 * A polite live region that is always mounted (so screen readers announce changes) and
 * never takes focus. Sits on the toast layer (z 80), above pop-ups and the trial lock.
 * Confetti is skipped under reduced motion.
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { CheckCircle2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useHasMounted } from '@/components/motion/useHasMounted';
import { Z_CLASS } from '@vesta/shared/utils/popup-core';
import {
  celebrationCopy,
  shouldShowConfetti,
  createToastScheduler,
  type CelebrationKind,
} from '@/lib/toast-core';
import '@vesta/shared/utils/i18n';

interface ToastItem {
  seq: number;
  title?: string;
  message: string;
  celebrate: boolean;
}

interface ToastApi {
  /** Show a plain message now. */
  show: (message: string) => void;
  /** Celebration toast; appears just after the source pop-up has finished closing. */
  celebrate: (kind: CelebrationKind, count?: number) => void;
}

const NOOP: ToastApi = { show: () => {}, celebrate: () => {} };
const ToastContext = createContext<ToastApi>(NOOP);

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

const CONFETTI = [
  { left: '8%', color: 'var(--color-primary)', size: 6, delay: 0 },
  { left: '24%', color: 'var(--color-secondary)', size: 5, delay: 0.08 },
  { left: '46%', color: 'var(--color-accent)', size: 7, delay: 0.04 },
  { left: '68%', color: 'var(--color-primary)', size: 5, delay: 0.12 },
  { left: '84%', color: 'var(--color-secondary)', size: 6, delay: 0.02 },
  { left: '94%', color: 'var(--color-accent)', size: 5, delay: 0.1 },
];

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const mounted = useHasMounted();
  const reduceRaw = useReducedMotion() ?? false;
  const reduced = mounted && reduceRaw;

  const [item, setItem] = useState<ToastItem | null>(null);
  const seq = useRef(0);
  const [scheduler] = useState(() =>
    createToastScheduler((next) => {
      if (!next) return setItem(null);
      seq.current += 1;
      setItem({ ...next, seq: seq.current });
    }),
  );

  useEffect(() => () => scheduler.dispose(), [scheduler]);

  const api = useMemo<ToastApi>(() => ({
    show: (message) => scheduler.show({ message }),
    celebrate: (kind, count) => {
      const c = celebrationCopy(kind, count);
      scheduler.celebrate({ title: t(c.titleKey, c.values), message: t(c.bodyKey, c.values) });
    },
  }), [scheduler, t]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-toast-region
            className={`fixed inset-x-0 flex justify-center px-4 pointer-events-none ${Z_CLASS.toast}`}
            style={{ bottom: 'calc(var(--bottom-nav-h, 0px) + env(safe-area-inset-bottom) + 1rem)' }}
          >
            <AnimatePresence>
              {item && (
                <motion.div
                  key={item.seq}
                  data-toast
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
                  animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
                  transition={reduced ? { duration: 0.15 } : { type: 'spring', damping: 26, stiffness: 320 }}
                  className="relative pointer-events-auto flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] py-3 pl-4 pr-2 shadow-xl"
                >
                  {item.celebrate && shouldShowConfetti(reduced) && (
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                      {CONFETTI.map((c, i) => (
                        <motion.span
                          key={i}
                          className="absolute top-0 rounded-full"
                          style={{ left: c.left, width: c.size, height: c.size, backgroundColor: c.color }}
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: [0, 1, 0], y: [-6, 26, 40] }}
                          transition={{ duration: 1.4, delay: c.delay, ease: 'easeOut' }}
                        />
                      ))}
                    </div>
                  )}
                  {item.celebrate && (
                    <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    {item.title && (
                      <p className="text-sm font-bold text-[var(--color-text-primary)]">{item.title}</p>
                    )}
                    <p className="text-sm text-[var(--color-text-secondary)]">{item.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={scheduler.dismiss}
                    aria-label={t('common.close')}
                    className="-my-1 -mr-1 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

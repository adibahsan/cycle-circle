'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { useHasMounted } from '@/components/motion/useHasMounted';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean;
  onClose: () => void;
  titleId: string;
  descId?: string;
  ariaLabel?: string;
  accentVar?: string;
  closeOnBackdrop?: boolean;
  hideClose?: boolean;
  panelClassName?: string;
  backdropClassName?: string;
  backdropStyle?: React.CSSProperties;
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Modal({
  open,
  onClose,
  titleId,
  descId,
  ariaLabel,
  accentVar = 'var(--color-primary)',
  closeOnBackdrop = true,
  hideClose = false,
  panelClassName,
  backdropClassName,
  backdropStyle,
  initialFocusRef,
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const mounted = useHasMounted();
  const reduce = useReducedMotion() ?? false;
  const prefersReduced = mounted && reduce;

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

  // Focus management: on open, focus initialFocusRef or panel
  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => {
        const target = initialFocusRef?.current ?? panelRef.current;
        target?.focus();
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [open, initialFocusRef]);

  // Build aria props: if ariaLabel is provided use aria-label; otherwise use aria-labelledby
  const labelProps = ariaLabel
    ? { 'aria-label': ariaLabel }
    : { 'aria-labelledby': titleId };

  const descProps = descId ? { 'aria-describedby': descId } : {};

  // Panel animation variants — gated by prefersReduced
  const panelInitial = prefersReduced ? { opacity: 0 } : { opacity: 0, y: '8%' };
  const panelAnimate = prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0 };
  const panelExit = prefersReduced
    ? { opacity: 0, transition: { duration: 0.15 } }
    : { opacity: 0, y: '6%', transition: { type: 'tween' as const, duration: 0.2, ease: [0.4, 0, 1, 1] as [number, number, number, number] } };
  const panelTransition = prefersReduced
    ? { duration: 0.15 }
    : { type: 'spring' as const, damping: 28, stiffness: 300 };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          {...labelProps}
          {...descProps}
        >
          {/* Backdrop */}
          <motion.div
            className={['absolute inset-0 bg-black/50 backdrop-blur-sm', backdropClassName].filter(Boolean).join(' ')}
            style={backdropStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden="true"
            onClick={closeOnBackdrop ? onClose : undefined}
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            className={[
              'relative z-10 w-full sm:max-w-md mx-4 sm:mx-auto',
              'rounded-t-3xl sm:rounded-3xl',
              'bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-xl',
              'overscroll-contain',
              'focus:outline-none',
              panelClassName,
            ]
              .filter(Boolean)
              .join(' ')}
            style={{
              overscrollBehavior: 'contain',
              maxHeight: '85dvh',
              overflowY: 'auto',
            }}
            initial={panelInitial}
            animate={panelAnimate}
            exit={panelExit}
            transition={panelTransition}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile handle bar */}
            <div className="flex justify-center pt-3 sm:hidden" aria-hidden="true">
              <div
                className="w-10 h-1 rounded-full"
                style={{
                  background: `color-mix(in srgb, ${accentVar} 30%, var(--color-border))`,
                }}
              />
            </div>

            {/* Close button */}
            {!hideClose && (
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2"
                style={
                  {
                    '--tw-ring-color': `color-mix(in srgb, ${accentVar} 50%, transparent)`,
                  } as React.CSSProperties
                }
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}

            {/* Content */}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

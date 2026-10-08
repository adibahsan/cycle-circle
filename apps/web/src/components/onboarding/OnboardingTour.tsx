'use client';

import { useEffect, useRef, useState, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/Button';
import { useHasMounted } from '@/components/motion/useHasMounted';
import { Z_CLASS, FOCUSABLE_SELECTOR, nextTrapIndex } from '@vesta/shared/utils/popup-core';
import { tourCardPlacement } from '@/components/shell/tour-placement';
import '@vesta/shared/utils/i18n';

// ─── Public API ───────────────────────────────────────────────────────────────

export interface TourStep {
  /** CSS selector, e.g. '[data-tour="log-button"]'. If omitted or element not
   *  found / not visible → centered fallback card. */
  targetSelector?: string;
  /** i18n key rendered via t(titleKey) */
  titleKey: string;
  /** i18n key rendered via t(descKey) */
  descKey: string;
}

export interface OnboardingTourProps {
  steps: TourStep[];
  open: boolean;
  /** Called once when the user finishes, skips, or presses ESC. */
  onClose: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SPOTLIGHT_PADDING = 8; // px around the target element
const CARD_MAX_WIDTH = 368;  // px — max-w-sm
const CARD_APPROX_HEIGHT = 240; // px — used for smart above/below placement
const VIEWPORT_MARGIN = 16; // px — horizontal clamp margin

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns null if el is not in the DOM or has no visible size. */
function getVisibleRect(el: Element | null): DOMRect | null {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const hasSize = rect.width > 0 && rect.height > 0;
  // offsetParent is null for display:none (but not position:fixed, so we check
  // size first which covers the common case).
  const inLayout = (el as HTMLElement).offsetParent !== null ||
    // position:fixed elements have offsetParent === null but are visible
    getComputedStyle(el).position === 'fixed';
  if (!hasSize || !inLayout) return null;
  return rect;
}

/**
 * Resolve a tour target by selector. The same `data-tour` attribute may appear
 * on multiple elements (e.g. a desktop sidebar link AND a mobile bottom-nav
 * link) — only one is visible at a given breakpoint, so pick the first match
 * that has a visible rect. Returns the visible element, or null.
 */
function findVisibleTarget(selector: string): { el: Element; rect: DOMRect } | null {
  if (typeof document === 'undefined') return null;
  const candidates = document.querySelectorAll(selector);
  for (const el of Array.from(candidates)) {
    const rect = getVisibleRect(el);
    if (rect) return { el, rect };
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OnboardingTour({
  steps,
  open,
  onClose,
}: OnboardingTourProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const reduceRaw = useReducedMotion() ?? false;
  const mounted = useHasMounted();
  const prefersReducedMotion = mounted && reduceRaw;

  const [current, setCurrent] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  // For focus management
  const nextBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  // Stable unique ids for aria
  const uid = useId();
  const titleId = `tour-title-${uid}`;
  const descId = `tour-desc-${uid}`;

  const step = steps[current] ?? null;
  const isLast = current === steps.length - 1;
  const isFirst = current === 0;

  // ── Locate & track target element ─────────────────────────────────────────

  const locateTarget = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (!step?.targetSelector) {
      setTargetRect(null);
      return;
    }
    const found = findVisibleTarget(step.targetSelector);

    if (found) {
      // Scroll it into view so the user can see what we're pointing at
      found.el.scrollIntoView({
        block: 'center',
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
      // Re-measure after scroll settles
      requestAnimationFrame(() => {
        const updated = findVisibleTarget(step.targetSelector!);
        setTargetRect(updated?.rect ?? null);
      });
    } else {
      setTargetRect(null);
    }
  }, [step, prefersReducedMotion]);

  // Re-locate on step change or open state change
  useEffect(() => {
    if (!open || !mounted) return;
    locateTarget();
  }, [open, mounted, current, locateTarget]);

  // Recompute rect on resize / scroll (rAF-debounced)
  useEffect(() => {
    if (!open || !mounted || typeof window === 'undefined') return;

    let rafId: number | null = null;

    const handle = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!step?.targetSelector) return;
        setTargetRect(findVisibleTarget(step.targetSelector)?.rect ?? null);
      });
    };

    window.addEventListener('resize', handle, { passive: true });
    window.addEventListener('scroll', handle, { passive: true, capture: true });

    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, true);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [open, mounted, step]);

  // ── Focus management ──────────────────────────────────────────────────────

  // Capture previously focused element when tour opens
  useEffect(() => {
    if (open && typeof document !== 'undefined') {
      previousFocusRef.current = document.activeElement;
    }
  }, [open]);

  // Move focus to the Next/Done button on each step
  useEffect(() => {
    if (!open || !mounted) return;
    const raf = requestAnimationFrame(() => {
      nextBtnRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open, mounted, current]);

  // Restore focus on close
  const handleClose = useCallback(() => {
    onClose();
    requestAnimationFrame(() => {
      if (
        previousFocusRef.current &&
        typeof (previousFocusRef.current as HTMLElement).focus === 'function'
      ) {
        (previousFocusRef.current as HTMLElement).focus();
      }
    });
  }, [onClose]);

  // ── ESC to close ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
      // Basic focus trap: if Tab would leave, redirect to Next button
      if (e.key === 'Tab') {
        const card = document.getElementById(`tour-card-${uid}`);
        if (!card) return;
        const focusable = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (focusable.length === 0) return;
        const idx = focusable.indexOf(document.activeElement as HTMLElement);
        const next = nextTrapIndex(focusable.length, idx, e.shiftKey);
        if (next !== null) {
          e.preventDefault();
          focusable[next]?.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose, uid]);

  // ── Body scroll lock ──────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // ── Early return ──────────────────────────────────────────────────────────

  if (!open || !mounted || steps.length === 0 || !step) return null;

  // ── Spotlight geometry ────────────────────────────────────────────────────

  const spotlightStyle: React.CSSProperties | undefined = targetRect
    ? {
        position: 'absolute',
        top: targetRect.top - SPOTLIGHT_PADDING,
        left: targetRect.left - SPOTLIGHT_PADDING,
        width: targetRect.width + SPOTLIGHT_PADDING * 2,
        height: targetRect.height + SPOTLIGHT_PADDING * 2,
        borderRadius: 16,
        boxShadow: '0 0 0 9999px color-mix(in srgb, var(--color-brand-navy) 60%, transparent)',
        pointerEvents: 'none',
        transition: prefersReducedMotion
          ? 'none'
          : 'top 0.28s cubic-bezier(0.22,1,0.36,1), left 0.28s cubic-bezier(0.22,1,0.36,1), width 0.28s cubic-bezier(0.22,1,0.36,1), height 0.28s cubic-bezier(0.22,1,0.36,1)',
      }
    : undefined;

  // ── Tooltip card positioning ──────────────────────────────────────────────

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768;

  const isMobileViewport = viewportWidth <= 640;

  let cardStyle: React.CSSProperties = {};

  if (targetRect && !isMobileViewport) {
    // Determine vertical placement: prefer below, fallback above
    const spaceBelow = viewportHeight - (targetRect.bottom + SPOTLIGHT_PADDING);
    const placeBelow = spaceBelow >= CARD_APPROX_HEIGHT + 12;

    const cardTop = placeBelow
      ? targetRect.bottom + SPOTLIGHT_PADDING + 12
      : targetRect.top - SPOTLIGHT_PADDING - CARD_APPROX_HEIGHT - 12;

    // Horizontal: align with target left, clamp within viewport
    const rawLeft = targetRect.left;
    const clampedLeft = Math.min(
      Math.max(rawLeft, VIEWPORT_MARGIN),
      viewportWidth - CARD_MAX_WIDTH - VIEWPORT_MARGIN
    );

    cardStyle = {
      position: 'fixed',
      top: cardTop,
      left: clampedLeft,
      width: Math.min(CARD_MAX_WIDTH, viewportWidth - VIEWPORT_MARGIN * 2),
      maxWidth: CARD_MAX_WIDTH,
    };
  } else if (isMobileViewport) {
    // Phone: float above the bottom nav (and above the spotlit item when it is in the nav).
    const navEl = document.querySelector('[data-bottom-nav]');
    const navTop = navEl ? navEl.getBoundingClientRect().top : viewportHeight;
    cardStyle = {
      position: 'fixed',
      maxWidth: '100%',
      ...tourCardPlacement({
        viewportWidth,
        viewportHeight,
        navTop,
        target: targetRect,
        spotlightPadding: SPOTLIGHT_PADDING,
        cardHeight: CARD_APPROX_HEIGHT,
        margin: VIEWPORT_MARGIN,
      }),
    };
  } else {
    // Centered fallback (no rect, wide viewport)
    cardStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: Math.min(CARD_MAX_WIDTH, viewportWidth - VIEWPORT_MARGIN * 2),
      maxWidth: CARD_MAX_WIDTH,
    };
  }

  // ── Controls ──────────────────────────────────────────────────────────────

  function handleNext() {
    if (isLast) {
      handleClose();
    } else {
      setCurrent((c) => c + 1);
    }
  }

  function handleBack() {
    if (!isFirst) setCurrent((c) => c - 1);
  }

  function handleSkip() {
    handleClose();
  }

  // ── Motion variants ───────────────────────────────────────────────────────

  const cardAnimProps = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.15 },
      }
    : {
        initial: { opacity: 0, y: 8, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: {
          duration: 0.28,
          ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
        },
      };

  // ── Render ────────────────────────────────────────────────────────────────

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className={`fixed inset-0 ${Z_CLASS.prompt}`}
    >
      {/* ── Backdrop / Spotlight layer ─────────────────────────────────────── */}
      {targetRect ? (
        // Spotlight: full-screen container, spotlight cutout via box-shadow
        <div className="absolute inset-0" aria-hidden="true">
          <div style={spotlightStyle} />
        </div>
      ) : (
        // Centered fallback: solid dim backdrop
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          aria-hidden="true"
          onClick={handleClose}
        />
      )}

      {/* ── Tooltip card ──────────────────────────────────────────────────── */}
      <motion.div
        key={current}
        id={`tour-card-${uid}`}
        {...cardAnimProps}
        className="glass bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-glow rounded-2xl p-5 z-[61]"
        style={{
          ...cardStyle,
          overscrollBehavior: 'contain',
        }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Step label */}
        <p
          className="text-xs font-medium text-[var(--color-text-muted)] mb-2 tabular-nums"
          style={{ fontVariantNumeric: 'tabular-nums' }}
          aria-hidden="true"
        >
          {t('tour.stepLabel', {
            current: current + 1,
            total: steps.length,
          })}
        </p>

        {/* Title */}
        <h2
          id={titleId}
          className="text-base font-bold text-[var(--color-text-primary)] leading-snug mb-1.5"
        >
          {t(step.titleKey)}
        </h2>

        {/* Description */}
        <p
          id={descId}
          className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-4"
        >
          {t(step.descKey)}
        </p>

        {/* Progress dots */}
        <div
          className="flex items-center gap-1.5 mb-4"
          role="tablist"
          aria-label={t('tour.progressLabel')}
        >
          {steps.map((_, i) => (
            <div
              key={i}
              role="tab"
              aria-selected={i === current}
              aria-label={t('tour.stepDot', {
                step: i + 1,
              })}
              className="h-1.5 rounded-full transition-[width,background-color] duration-200"
              style={{
                width: i === current ? 20 : 6,
                backgroundColor:
                  i <= current
                    ? 'var(--color-primary)'
                    : 'var(--color-border)',
              }}
            />
          ))}
        </div>

        {/* Button row */}
        <div className="flex items-center gap-2">
          {/* Back — left side, only when not on first step */}
          {!isFirst && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="mr-auto"
            >
              {t('tour.back')}
            </Button>
          )}

          {/* Spacer when no Back button to push right-side buttons to the end */}
          {isFirst && <div className="flex-1" aria-hidden="true" />}

          {/* Skip — hidden on last step */}
          {!isLast && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
            >
              {t('tour.skip')}
            </Button>
          )}

          {/* Next / Done — native <button> so we can attach a ref for focus management */}
          <button
            ref={nextBtnRef}
            type="button"
            onClick={handleNext}
            className="inline-flex items-center justify-center font-semibold rounded-xl transition-[color,background-color,border-color,box-shadow,transform] duration-200 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)] bg-[var(--color-action)] text-[var(--color-on-action)] hover:bg-[var(--color-primary-dark)] shadow-soft px-3 py-1.5 text-sm"
          >
            {isLast
              ? t('tour.done')
              : t('tour.next')}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

'use client';

/**
 * Pop-up shell. The one custom dialog every pop-up in the app is built on.
 *
 *   import { Modal } from '@/components/ui/Modal';
 *   import { Z_LAYER, Z_CLASS } from '@/components/ui/popup-core';
 *
 * Owns: portal into <body>, topmost-only ESC, focus trap + restore, inert background,
 * ref-counted scroll lock, bottom-sheet (< sm) / centred card (>= sm) geometry with a
 * pinned header/footer and scrolling body, enter+exit motion, one theme-aware backdrop.
 */

import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useHasMounted } from '@/components/motion/useHasMounted';
import {
  Z_CLASS,
  FOCUSABLE_SELECTOR,
  createInertManager,
  createPopupStack,
  createScrollLock,
  nextTrapIndex,
  type PopupLayer,
} from '@/components/ui/popup-core';

// ─── Module singletons (shared by every open pop-up) ─────────────────────────

const stack = createPopupStack();
const inertManager = createInertManager<HTMLElement>();
let scrollLock: ReturnType<typeof createScrollLock> | null = null;

function getScrollLock() {
  if (!scrollLock) {
    scrollLock = createScrollLock({
      html: document.documentElement,
      body: document.body,
      scrollbarWidth: () => window.innerWidth - document.documentElement.clientWidth,
    });
  }
  return scrollLock;
}

const NEVER_INERT = new Set(['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT', 'TEMPLATE']);

function backgroundElements(own: HTMLElement): HTMLElement[] {
  return Array.from(document.body.children).filter(
    (el): el is HTMLElement => el instanceof HTMLElement && el !== own && !NEVER_INERT.has(el.tagName),
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  titleId: string;
  descId?: string;
  /** Overrides aria-labelledby. */
  ariaLabel?: string;
  accentVar?: string;
  /** 'popup' (z 50, default, user-opened), 'prompt' (z 60, auto-prompts), 'lock' (z 70, trial lock). */
  layer?: PopupLayer;
  /**
   * false = non-dismissible (trial lock): ESC, backdrop click and the close button do nothing / are hidden.
   * Focus is still trapped and the background is still inert.
   */
  dismissible?: boolean;
  closeOnBackdrop?: boolean;
  hideClose?: boolean;
  /** Pinned above the scrolling body. */
  header?: React.ReactNode;
  /** Pinned below the scrolling body. */
  footer?: React.ReactNode;
  panelClassName?: string;
  backdropClassName?: string;
  backdropStyle?: React.CSSProperties;
  /** Else: first `[data-autofocus]`, else first focusable in the body, else the panel. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Children render in the scrolling body. */
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
  layer = 'popup',
  dismissible = true,
  closeOnBackdrop = true,
  hideClose = false,
  header,
  footer,
  panelClassName,
  backdropClassName,
  backdropStyle,
  initialFocusRef,
  children,
}: ModalProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const idRef = useRef<symbol>(Symbol('popup'));
  const openRef = useRef(open);
  openRef.current = open;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const mounted = useHasMounted();
  const reduce = useReducedMotion() ?? false;
  const prefersReduced = mounted && reduce;

  // Portal container, created at open time so later-opened pop-ups are later in the DOM.
  const [container, setContainer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (open && !container) {
      const el = document.createElement('div');
      el.setAttribute('data-popup-root', '');
      document.body.appendChild(el);
      setContainer(el);
    }
  }, [open, container]);
  useEffect(() => {
    return () => {
      container?.remove();
    };
  }, [container]);

  const handleExitComplete = () => {
    if (!openRef.current) setContainer(null);
  };

  // Stack, inert, scroll lock, focus restore, ESC — all keyed on open + container.
  useEffect(() => {
    if (!open || !container) return;
    const id = idRef.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    stack.push(id);
    const releaseInert = inertManager.apply(backgroundElements(container));
    const releaseScroll = getScrollLock().lock();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (stack.isTop(id) && dismissible) {
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }
      if (e.key !== 'Tab' || !stack.isTop(id)) return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0,
      );
      const current = items.indexOf(document.activeElement as HTMLElement);
      const next = nextTrapIndex(items.length, current, e.shiftKey);
      if (next === null) return;
      e.preventDefault();
      (next === -1 ? panel : items[next]).focus();
    }
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      stack.remove(id);
      releaseScroll();
      releaseInert();
      if (trigger && trigger.isConnected) trigger.focus();
    };
  }, [open, container, dismissible]);

  // Initial focus
  useEffect(() => {
    if (!open || !container) return;
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target =
        initialFocusRef?.current ??
        panel.querySelector<HTMLElement>('[data-autofocus]') ??
        bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
        panel;
      target.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open, container, initialFocusRef]);

  if (!container) return null;

  const labelProps = ariaLabel ? { 'aria-label': ariaLabel } : { 'aria-labelledby': titleId };
  const descProps = descId ? { 'aria-describedby': descId } : {};

  const panelInitial = prefersReduced ? { opacity: 0 } : { opacity: 0, y: '8%' };
  const panelAnimate = prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0 };
  const panelExit = prefersReduced
    ? { opacity: 0, transition: { duration: 0.15 } }
    : { opacity: 0, y: '6%', transition: { type: 'tween' as const, duration: 0.2, ease: [0.4, 0, 1, 1] as [number, number, number, number] } };
  const panelTransition = prefersReduced
    ? { duration: 0.15 }
    : { type: 'spring' as const, damping: 28, stiffness: 300 };

  const showClose = dismissible && !hideClose;

  return createPortal(
    <AnimatePresence onExitComplete={handleExitComplete}>
      {open && (
        <div
          className={`fixed inset-0 ${Z_CLASS[layer]} flex items-end sm:items-center justify-center overscroll-contain`}
          style={{ overscrollBehavior: 'contain' }}
        >
          {/* Backdrop (theme-aware) */}
          <motion.div
            className={['absolute inset-0 bg-black/50 dark:bg-black/70', backdropClassName].filter(Boolean).join(' ')}
            style={backdropStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReduced ? 0.1 : 0.2 }}
            aria-hidden="true"
            onClick={dismissible && closeOnBackdrop ? onClose : undefined}
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            {...labelProps}
            {...descProps}
            data-popup-panel=""
            data-popup-layer={layer}
            data-motion={prefersReduced ? 'reduced' : 'full'}
            tabIndex={-1}
            className={[
              'relative flex flex-col w-full sm:max-w-md sm:mx-auto',
              'rounded-t-3xl sm:rounded-3xl',
              'bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-xl',
              'pb-[env(safe-area-inset-bottom)] sm:pb-0',
              'focus:outline-none',
              panelClassName,
            ]
              .filter(Boolean)
              .join(' ')}
            style={{
              maxHeight: 'calc(100dvh - 1rem)',
              overscrollBehavior: 'contain',
            }}
            initial={panelInitial}
            animate={panelAnimate}
            exit={panelExit}
            transition={panelTransition}
            onClick={(e) => e.stopPropagation()}
          >
            {header && <div className="shrink-0">{header}</div>}

            {/* Scrolling body */}
            <div
              ref={bodyRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
              style={{ overscrollBehavior: 'contain' }}
            >
              {children}
            </div>

            {footer && <div className="shrink-0">{footer}</div>}

            {showClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label={t('common.close')}
                className="absolute top-3 right-3 p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2"
                style={
                  {
                    '--tw-ring-color': `color-mix(in srgb, ${accentVar} 50%, transparent)`,
                  } as React.CSSProperties
                }
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    container,
  );
}

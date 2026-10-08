'use client';

import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Z_CLASS, POPUP_BACKDROP_CLASS, type PopupLayer } from '@vesta/shared/utils/popup-core';
import { usePopupBehavior, usePopupRoot } from '@vesta/shared/utils/use-popup-behavior';

/** Exit animation length; keep in sync with the popup-* keyframes in globals.css. */
const EXIT_MS = 200;

interface ModalProps {
  open: boolean;
  onClose: () => void;
  titleId: string;
  /** false while a request is in flight: ESC, backdrop and the X do nothing. */
  dismissible?: boolean;
  layer?: PopupLayer;
  hideClose?: boolean;
  /** Pinned above the scrolling body. */
  header?: ReactNode;
  /** Pinned below the scrolling body. */
  footer?: ReactNode;
  panelClassName?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/**
 * Admin pop-up shell: portal, ESC, focus trap/restore, inert background, scroll lock.
 * Bottom sheet below sm (safe-area padding, dvh max height, pinned header/footer), centred card from sm up.
 */
export function Modal({
  open,
  onClose,
  titleId,
  dismissible = true,
  layer = 'popup',
  hideClose = true,
  header,
  footer,
  panelClassName,
  initialFocusRef,
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { container, onExitComplete } = usePopupRoot(open, { animateExit: true });
  usePopupBehavior({ open, container, panelRef, onClose, dismissible, initialFocusRef });

  // Unmount once the exit animation has played (instantly for reduced motion).
  useEffect(() => {
    if (open || !container) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(onExitComplete, reduce ? 0 : EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open, container, onExitComplete]);

  if (!container) return null;
  const state = open ? 'open' : 'closed';

  return createPortal(
    <div
      className={`fixed inset-0 ${Z_CLASS[layer]} flex items-end justify-center overscroll-contain sm:items-center sm:p-4 ${open ? '' : 'pointer-events-none'}`}
      style={{ overscrollBehavior: 'contain' }}
    >
      <div
        className={`absolute inset-0 ${POPUP_BACKDROP_CLASS}`}
        data-popup-backdrop=""
        data-state={state}
        aria-hidden="true"
        onClick={dismissible ? onClose : undefined}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-popup-panel=""
        data-popup-sheet=""
        data-state={state}
        tabIndex={-1}
        className={[
          'relative flex w-full flex-col border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-xl focus-visible:outline-none',
          'max-h-[calc(100dvh-1rem)] rounded-t-3xl pb-[env(safe-area-inset-bottom)]',
          'sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:rounded-2xl sm:pb-0',
          panelClassName,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ overscrollBehavior: 'contain' }}
      >
        {header && <div className="shrink-0">{header}</div>}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" style={{ overscrollBehavior: 'contain' }}>
          {children}
        </div>
        {footer && <div className="shrink-0">{footer}</div>}
        {!hideClose && dismissible && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="absolute right-3 top-3 rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>,
    container,
  );
}

'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Z_CLASS, type PopupLayer } from '@vesta/shared/utils/popup-core';
import { usePopupBehavior } from './usePopupBehavior';

/** Portal container appended to <body> while `open` (removed on close). */
export function usePopupRoot(open: boolean) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const el = document.createElement('div');
    el.setAttribute('data-popup-root', '');
    document.body.appendChild(el);
    setContainer(el);
    return () => {
      el.remove();
      setContainer(null);
    };
  }, [open]);
  return container;
}

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

/** Admin pop-up shell: portal, ESC, focus trap/restore, inert background, scroll lock. */
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
  const container = usePopupRoot(open);
  usePopupBehavior({ open, container, panelRef, onClose, dismissible, initialFocusRef });

  if (!open || !container) return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${Z_CLASS[layer]} flex items-center justify-center p-4 overscroll-contain`}
      style={{ overscrollBehavior: 'contain' }}
    >
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70"
        aria-hidden="true"
        onClick={dismissible ? onClose : undefined}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-popup-panel=""
        tabIndex={-1}
        className={[
          'relative flex w-full max-w-md flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-xl focus:outline-none',
          panelClassName,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ maxHeight: 'calc(100dvh - 2rem)', overscrollBehavior: 'contain' }}
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

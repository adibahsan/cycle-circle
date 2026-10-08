'use client';

import { useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Z_CLASS, POPUP_BACKDROP_CLASS } from '@vesta/shared/utils/popup-core';
import { usePopupBehavior, usePopupRoot } from '@vesta/shared/utils/use-popup-behavior';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name of the drawer. */
  label: string;
  /** Heading content next to the close control. */
  title: ReactNode;
  children: ReactNode;
}

/** Left-side drawer on the pop-up shell (mobile navigation). */
export function Drawer({ open, onClose, label, title, children }: DrawerProps) {
  const panelRef = useRef<HTMLElement>(null);
  const { container } = usePopupRoot(open);
  usePopupBehavior({ open, container, panelRef, onClose });

  if (!open || !container) return null;

  return createPortal(
    <div className={`fixed inset-0 ${Z_CLASS.popup} md:hidden`} style={{ overscrollBehavior: 'contain' }}>
      <div className={`absolute inset-0 ${POPUP_BACKDROP_CLASS}`} aria-hidden="true" onClick={onClose} />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-popup-panel=""
        tabIndex={-1}
        className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-card)] focus-visible:outline-none"
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-4">
          {title}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="rounded-xl p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </aside>
    </div>,
    container,
  );
}

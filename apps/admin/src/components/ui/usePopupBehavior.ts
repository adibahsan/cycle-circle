'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { FOCUSABLE_SELECTOR, nextTrapIndex } from '@vesta/shared/utils/popup-core';
import {
  popupStack,
  inertManager,
  getScrollLock,
  backgroundElements,
} from '@vesta/shared/utils/popup-runtime';

interface Options {
  open: boolean;
  /** The `[data-popup-root]` element portalled into <body>. */
  container: HTMLElement | null;
  panelRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  /** false: ESC does nothing (e.g. while a request is in flight). */
  dismissible?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * The shell's behaviours, shared by Modal and Drawer: topmost-only ESC, Tab trap (covers
 * everything inside the popup root, so an anchored picker is included), inert background,
 * counted scroll lock, initial focus and focus restore.
 */
export function usePopupBehavior({
  open,
  container,
  panelRef,
  onClose,
  dismissible = true,
  initialFocusRef,
}: Options) {
  const idRef = useRef<symbol>(Symbol('popup'));
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || !container) return;
    const id = idRef.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    popupStack.push(id);
    const releaseInert = inertManager.apply(backgroundElements(container));
    const releaseScroll = getScrollLock().lock();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (popupStack.isTop(id) && dismissible) {
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }
      if (e.key !== 'Tab' || !popupStack.isTop(id) || !container) return;
      const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0,
      );
      const current = items.indexOf(document.activeElement as HTMLElement);
      const next = nextTrapIndex(items.length, current, e.shiftKey);
      if (next === null) return;
      e.preventDefault();
      (next === -1 ? panelRef.current : items[next])?.focus();
    }
    document.addEventListener('keydown', onKeyDown);

    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target =
        initialFocusRef?.current ??
        panel.querySelector<HTMLElement>('[data-autofocus]') ??
        panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
        panel;
      target.focus();
    });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown);
      popupStack.remove(id);
      releaseScroll();
      releaseInert();
      if (trigger && trigger.isConnected) trigger.focus();
    };
  }, [open, container, dismissible, panelRef, initialFocusRef]);
}

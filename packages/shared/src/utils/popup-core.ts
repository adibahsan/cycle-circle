/**
 * Pure (DOM-injectable) logic behind the pop-up shell (`Modal`). Kept free of React
 * so it can be unit-tested in the node vitest environment.
 */

// ─── z-index layers ──────────────────────────────────────────────────────────
// Defined once, used by name. Class strings are literal so Tailwind can see them.

export const Z_LAYER = {
  chrome: 40,
  popup: 50,
  /** Anchored pickers (date/time) inside a pop-up: above the panel, below auto-prompts. */
  popover: 55,
  prompt: 60,
  lock: 70,
  toast: 80,
} as const;

export type PopupLayer = 'popup' | 'prompt' | 'lock';

export const Z_CLASS: Record<keyof typeof Z_LAYER, string> = {
  chrome: 'z-[40]',
  popup: 'z-[50]',
  popover: 'z-[55]',
  prompt: 'z-[60]',
  lock: 'z-[70]',
  toast: 'z-[80]',
};

/** The one pop-up backdrop (web and admin): theme-aware scrim plus a light blur. */
export const POPUP_BACKDROP_CLASS = 'bg-black/50 dark:bg-black/70 backdrop-blur-sm';

// ─── Open pop-up stack (ESC closes the topmost only) ─────────────────────────

export function createPopupStack() {
  const ids: symbol[] = [];
  return {
    push(id: symbol) {
      if (!ids.includes(id)) ids.push(id);
    },
    remove(id: symbol) {
      const i = ids.indexOf(id);
      if (i >= 0) ids.splice(i, 1);
    },
    isTop(id: symbol) {
      return ids.length > 0 && ids[ids.length - 1] === id;
    },
    size: () => ids.length,
  };
}

// ─── Reference-counted scroll lock ───────────────────────────────────────────

interface StyleHost {
  style: { overflow: string; paddingRight: string };
}

export interface ScrollLockTargets {
  html: StyleHost;
  body: StyleHost;
  /** Scrollbar width in px to compensate for while locked. */
  scrollbarWidth: () => number;
}

/** Returns `lock()`, which returns an idempotent `release()`. Last release restores prior styles. */
export function createScrollLock(targets: ScrollLockTargets) {
  let count = 0;
  let saved: { html: string; body: string; padding: string } | null = null;
  return {
    lock(): () => void {
      if (count === 0) {
        saved = {
          html: targets.html.style.overflow,
          body: targets.body.style.overflow,
          padding: targets.body.style.paddingRight,
        };
        const sb = targets.scrollbarWidth();
        targets.html.style.overflow = 'hidden';
        targets.body.style.overflow = 'hidden';
        if (sb > 0) targets.body.style.paddingRight = `${sb}px`;
      }
      count += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        count -= 1;
        if (count === 0 && saved) {
          targets.html.style.overflow = saved.html;
          targets.body.style.overflow = saved.body;
          targets.body.style.paddingRight = saved.padding;
          saved = null;
        }
      };
    },
    count: () => count,
  };
}

// ─── Reference-counted inert ─────────────────────────────────────────────────

interface InertEl {
  inert: boolean;
}

/** Each element stays inert until every holder has released it. */
export function createInertManager<T extends InertEl>() {
  const counts = new Map<T, number>();
  return {
    /** Mark `els` inert; returns an idempotent release. */
    apply(els: T[]): () => void {
      for (const el of els) {
        counts.set(el, (counts.get(el) ?? 0) + 1);
        el.inert = true;
      }
      let released = false;
      return () => {
        if (released) return;
        released = true;
        for (const el of els) {
          const n = (counts.get(el) ?? 1) - 1;
          if (n <= 0) {
            counts.delete(el);
            el.inert = false;
          } else counts.set(el, n);
        }
      };
    },
  };
}

// ─── Focus trap ──────────────────────────────────────────────────────────────

export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Where Tab/Shift+Tab should move. Returns the index to focus, or null to let the
 * browser move focus natively (it stays inside the list).
 * `current` is the index of the focused element in `count`, or -1 if focus is outside the list.
 */
export function nextTrapIndex(count: number, current: number, shift: boolean): number | null {
  if (count === 0) return -1; // nothing focusable: caller focuses the panel
  if (current === -1) return shift ? count - 1 : 0;
  if (!shift && current === count - 1) return 0;
  if (shift && current === 0) return count - 1;
  return null;
}

// ─── Anchored popover placement ──────────────────────────────────────────────

export interface AnchorRect {
  left: number;
  top: number;
  bottom: number;
  width: number;
}

/**
 * Fixed-position coordinates for a popover anchored to an element: below by default,
 * flipped above when it does not fit, clamped inside the viewport.
 */
export function placePopover(
  anchor: AnchorRect,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 6,
  margin = 8,
): { left: number; top: number } {
  const maxLeft = Math.max(margin, viewport.width - margin - size.width);
  const left = Math.min(Math.max(anchor.left, margin), maxLeft);
  const below = anchor.bottom + gap;
  const fitsBelow = below + size.height <= viewport.height - margin;
  const above = anchor.top - gap - size.height;
  let top = fitsBelow ? below : above >= margin ? above : viewport.height - margin - size.height;
  top = Math.max(margin, top);
  return { left, top };
}

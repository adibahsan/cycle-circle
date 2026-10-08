/**
 * Browser singletons behind the pop-up shell (one per app bundle): the open-pop-up
 * stack (ESC closes the topmost), the ref-counted inert manager and scroll lock.
 * Typed structurally because this package is compiled without the DOM lib.
 */
import { createInertManager, createPopupStack, createScrollLock } from './popup-core';

interface DomEl {
  tagName: string;
  inert: boolean;
  style: { overflow: string; paddingRight: string };
  clientWidth: number;
}
interface DomGlobals {
  document: { documentElement: DomEl; body: DomEl & { children: ArrayLike<DomEl> } };
  window: { innerWidth: number };
}
const dom = () => globalThis as unknown as DomGlobals;

export const popupStack = createPopupStack();
export const inertManager = createInertManager<{ inert: boolean }>();

let scrollLock: ReturnType<typeof createScrollLock> | null = null;
export function getScrollLock() {
  if (!scrollLock) {
    const { document, window } = dom();
    scrollLock = createScrollLock({
      html: document.documentElement,
      body: document.body,
      scrollbarWidth: () => window.innerWidth - document.documentElement.clientWidth,
    });
  }
  return scrollLock;
}

const NEVER_INERT = new Set(['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT', 'TEMPLATE']);

/** Direct children of <body> other than `own` (they become inert while a pop-up is open). */
export function backgroundElements<T extends { tagName: string; inert: boolean }>(own: T): T[] {
  return (Array.from(dom().document.body.children) as unknown as T[]).filter(
    (el) => el !== own && !NEVER_INERT.has(el.tagName),
  );
}

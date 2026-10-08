import { describe, it, expect } from 'vitest';
import {
  Z_LAYER,
  createPopupStack,
  createScrollLock,
  createInertManager,
  nextTrapIndex,
} from '@/components/ui/popup-core';

function fakeTargets(sb = 15) {
  return {
    html: { style: { overflow: '', paddingRight: '' } },
    body: { style: { overflow: 'auto', paddingRight: '2px' } },
    scrollbarWidth: () => sb,
  };
}

describe('Z_LAYER', () => {
  it('orders chrome < popup < prompt < lock < toast with the spec values', () => {
    expect(Z_LAYER).toEqual({ chrome: 40, popup: 50, prompt: 60, lock: 70, toast: 80 });
  });
});

describe('popup stack', () => {
  it('only the most recently opened pop-up is on top; removing it exposes the next', () => {
    const s = createPopupStack();
    const a = Symbol('a');
    const b = Symbol('b');
    s.push(a);
    s.push(b);
    expect(s.isTop(a)).toBe(false);
    expect(s.isTop(b)).toBe(true);
    s.remove(b);
    expect(s.isTop(a)).toBe(true);
    s.remove(a);
    expect(s.size()).toBe(0);
  });
});

describe('scroll lock', () => {
  it('locks on first holder and restores prior styles on last release', () => {
    const t = fakeTargets();
    const l = createScrollLock(t);
    const r1 = l.lock();
    expect(t.body.style.overflow).toBe('hidden');
    expect(t.html.style.overflow).toBe('hidden');
    expect(t.body.style.paddingRight).toBe('15px');
    r1();
    expect(t.body.style.overflow).toBe('auto');
    expect(t.html.style.overflow).toBe('');
    expect(t.body.style.paddingRight).toBe('2px');
  });

  it('two overlapping locks: closing either one in any order keeps the page locked until both are gone', () => {
    for (const firstOut of [0, 1]) {
      const t = fakeTargets();
      const l = createScrollLock(t);
      const rs = [l.lock(), l.lock()];
      rs[firstOut]();
      expect(t.body.style.overflow).toBe('hidden');
      rs[1 - firstOut]();
      expect(t.body.style.overflow).toBe('auto');
      expect(l.count()).toBe(0);
    }
  });

  it('release is idempotent (double release does not clobber another holder)', () => {
    const t = fakeTargets();
    const l = createScrollLock(t);
    const r1 = l.lock();
    l.lock();
    r1();
    r1();
    expect(l.count()).toBe(1);
    expect(t.body.style.overflow).toBe('hidden');
  });

  it('does not add padding when there is no scrollbar', () => {
    const t = fakeTargets(0);
    createScrollLock(t).lock();
    expect(t.body.style.paddingRight).toBe('2px');
  });
});

describe('inert manager', () => {
  it('an element shared by two holders stays inert until both release', () => {
    const m = createInertManager<{ inert: boolean }>();
    const el = { inert: false };
    const r1 = m.apply([el]);
    const r2 = m.apply([el]);
    r1();
    expect(el.inert).toBe(true);
    r2();
    expect(el.inert).toBe(false);
  });
});

describe('nextTrapIndex', () => {
  it('wraps forward from the last and backward from the first', () => {
    expect(nextTrapIndex(3, 2, false)).toBe(0);
    expect(nextTrapIndex(3, 0, true)).toBe(2);
  });
  it('lets the browser handle moves inside the list', () => {
    expect(nextTrapIndex(3, 1, false)).toBeNull();
    expect(nextTrapIndex(3, 1, true)).toBeNull();
  });
  it('pulls stray focus back in', () => {
    expect(nextTrapIndex(3, -1, false)).toBe(0);
    expect(nextTrapIndex(3, -1, true)).toBe(2);
  });
  it('signals an empty list', () => {
    expect(nextTrapIndex(0, -1, false)).toBe(-1);
  });
});

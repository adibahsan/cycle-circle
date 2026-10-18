import { describe, expect, it } from 'vitest';
import { parseSidebarPref, resolveCollapsed, SIDEBAR_STORAGE_KEY } from '@/components/shell/sidebar-collapsed';

describe('sidebar collapse state', () => {
  it('uses the agreed storage key', () => {
    expect(SIDEBAR_STORAGE_KEY).toBe('vesta.sidebarCollapsed');
  });
  it('parses stored values, defaulting to auto', () => {
    expect(parseSidebarPref('true')).toBe('true');
    expect(parseSidebarPref('false')).toBe('false');
    expect(parseSidebarPref(null)).toBe('auto');
    expect(parseSidebarPref('garbage')).toBe('auto');
  });
  it('auto collapses below xl and expands at xl', () => {
    expect(resolveCollapsed('auto', false)).toBe(true);
    expect(resolveCollapsed('auto', true)).toBe(false);
  });
  it('a stored choice wins at every width', () => {
    expect(resolveCollapsed('true', true)).toBe(true);
    expect(resolveCollapsed('false', false)).toBe(false);
  });
});

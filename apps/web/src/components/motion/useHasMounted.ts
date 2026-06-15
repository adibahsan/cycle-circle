'use client';
import { useEffect, useState } from 'react';

/**
 * Returns `false` on the server and on the first client render, then `true`
 * after the component mounts.
 *
 * Use this to gate reduced-motion fallbacks in motion components. `useReducedMotion()`
 * reads the media query on the client but returns its default on the server, so branching
 * the rendered tree on it directly causes a hydration mismatch for reduced-motion users.
 * Gating on `useHasMounted()` keeps the server output and the first client render identical
 * (both render the animated tree); the reduced-motion variant only applies after mount.
 */
export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

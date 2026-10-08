'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Admin chart palette (Cycle Circle brand). Recharts writes colours into SVG
 * attributes and inline styles, so tokens are resolved to concrete strings at
 * runtime from the CSS variables in globals.css, with literal light-theme
 * fallbacks equal to the spec hexes (used on the server and in tests).
 */
export interface ChartToken {
  name: string
  cssVar: string
  fallback: string
}

/** Ordered series palette. Index order is the series order. */
export const CHART_TOKENS: readonly ChartToken[] = [
  { name: 'primary', cssVar: '--color-primary', fallback: '#D02F58' },
  { name: 'secondary', cssVar: '--color-secondary', fallback: '#8E5BC4' },
  { name: 'accent', cssVar: '--color-accent', fallback: '#C2993F' },
  { name: 'coral', cssVar: '--color-coral', fallback: '#FF8C66' },
  { name: 'slate', cssVar: '--color-text-secondary', fallback: '#565266' },
  { name: 'follicular', cssVar: '--color-follicular', fallback: '#FF8FA8' },
] as const

/** CSS var() strings for HTML style props and as ChartSeries.color values. */
export const CHART_VAR = {
  primary: 'var(--color-primary)',
  secondary: 'var(--color-secondary)',
  accent: 'var(--color-accent)',
  coral: 'var(--color-coral)',
  slate: 'var(--color-text-secondary)',
  follicular: 'var(--color-follicular)',
  /** Stroke ring around active dots. */
  surface: 'var(--color-bg-card)',
  /** Semantic status, matching admin's emerald/amber/red badges. Always shown next to a number or label. */
  good: '#059669',
  mid: '#D97706',
  low: 'var(--color-error, #B4441C)',
} as const

const FALLBACKS: Record<string, string> = {
  '--color-bg-card': '#FFFFFF',
  '--color-error': '#B4441C',
  ...Object.fromEntries(CHART_TOKENS.map((t) => [t.cssVar, t.fallback])),
}

const VAR_RE = /^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/

/** Resolve `var(--x)` to a concrete colour; other strings pass through. */
export function resolveChartColor(value: string, root?: Element | null): string {
  const m = VAR_RE.exec(value.trim())
  if (!m) return value
  const [, name, inline] = m
  if (root && typeof getComputedStyle === 'function') {
    const live = getComputedStyle(root).getPropertyValue(name).trim()
    if (live) return live
  }
  return FALLBACKS[name] ?? inline?.trim() ?? value
}

/** Resolved ordered palette (fallback hexes when no root is given). */
export function chartPalette(root?: Element | null): string[] {
  return CHART_TOKENS.map((t) => resolveChartColor(`var(${t.cssVar})`, root))
}

/**
 * Hook returning a colour resolver. Renders fallbacks first (SSR-safe), then
 * live theme values, and re-resolves when the `dark` class toggles.
 */
export function useChartColors(): (value: string) => string {
  const [root, setRoot] = useState<Element | null>(null)
  const [, bump] = useState(0)
  useEffect(() => {
    const el = document.documentElement
    setRoot(el)
    const obs = new MutationObserver(() => bump((n) => n + 1))
    obs.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return useCallback((value: string) => resolveChartColor(value, root), [root])
}

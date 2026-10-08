import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  BOTTOM_NAV_ITEMS,
  MORE_ITEMS,
  SIDEBAR_MENU_ITEMS,
  SIDEBAR_MORE_ITEMS,
  isNavActive,
  isMoreActive,
} from '@/components/shell/nav-config'
import { tourCardPlacement } from '@/components/shell/tour-placement'

const SRC = path.resolve(__dirname, '../../src')
const read = (p: string) => fs.readFileSync(path.join(SRC, p), 'utf8')

describe('nav config', () => {
  it('bottom nav is exactly Dashboard, Calendar, Symptoms, Insights (plus the More slot)', () => {
    expect(BOTTOM_NAV_ITEMS.map((i) => i.href)).toEqual(['/dashboard', '/calendar', '/symptoms', '/insights'])
  })

  it('the More sheet holds every destination removed from the bottom nav', () => {
    expect(MORE_ITEMS.map((i) => i.href).sort()).toEqual(
      ['/content', '/feedback', '/profiles', '/settings', '/subscription'].sort(),
    )
  })

  it('the desktop sidebar keeps every destination', () => {
    const all = [...SIDEBAR_MENU_ITEMS, ...SIDEBAR_MORE_ITEMS].map((i) => i.href).sort()
    expect(all).toEqual(
      ['/calendar', '/content', '/dashboard', '/feedback', '/insights', '/profiles', '/settings', '/subscription', '/symptoms'].sort(),
    )
  })

  it('only the current page is active; More is active on its own pages', () => {
    expect(isNavActive('/calendar', '/calendar')).toBe(true)
    expect(isNavActive('/calendar', '/symptoms')).toBe(false)
    expect(isMoreActive('/settings')).toBe(true)
    expect(isMoreActive('/dashboard')).toBe(false)
  })
})

describe('tour card placement on phones', () => {
  const vw = 375
  const vh = 667
  const navTop = 667 - 56
  const rect = (top: number, h = 40) => ({ top, bottom: top + h, left: 20, right: 90, width: 70, height: h })

  it('sits above the nav when the target is a nav item', () => {
    const p = tourCardPlacement({ viewportWidth: vw, viewportHeight: vh, navTop, target: rect(navTop + 8) })
    expect(p.bottom).toBeDefined()
    // card bottom edge (vh - bottom) is above the spotlight top
    expect(vh - (p.bottom as number)).toBeLessThanOrEqual(navTop + 8 - 8)
  })

  it('stays above the nav when there is no target', () => {
    const p = tourCardPlacement({ viewportWidth: vw, viewportHeight: vh, navTop, target: null })
    expect(vh - (p.bottom as number)).toBeLessThanOrEqual(navTop)
  })

  it('moves to the top when the target would sit under a bottom card', () => {
    const p = tourCardPlacement({ viewportWidth: vw, viewportHeight: vh, navTop, target: rect(420) })
    expect(p.top).toBeDefined()
    expect(p.bottom).toBeUndefined()
  })

  it('stays at the bottom, above the nav, for a target high on the page', () => {
    const p = tourCardPlacement({ viewportWidth: vw, viewportHeight: vh, navTop, target: rect(90) })
    expect(p.bottom).toBeDefined()
    expect(vh - (p.bottom as number)).toBeLessThanOrEqual(navTop)
  })
})

describe('phone shell source rules', () => {
  const layout = read('app/(main)/layout.tsx')
  const globals = read('app/globals.css')

  it('root layout exports a viewport with viewport-fit=cover', () => {
    expect(read('app/layout.tsx')).toMatch(/export const viewport[\s\S]*viewportFit:\s*'cover'/)
  })

  it('the shell exposes the bottom-nav height as a CSS variable', () => {
    expect(globals).toMatch(/--bottom-nav-h:/)
  })

  it('the Symptoms save bar offsets from the variable and the safe-area inset, not pixels', () => {
    const s = read('app/(main)/symptoms/SymptomsClient.tsx')
    expect(s).not.toMatch(/bottom-\[\d+px\]/)
    expect(s).toMatch(/var\(--bottom-nav-h\)/)
    expect(s).toMatch(/env\(safe-area-inset-bottom\)/)
  })

  it('no hard-coded nav offsets or outline treatment remain in the shell', () => {
    for (const src of [layout, read('components/shell/BottomNav.tsx')]) {
      expect(src).not.toMatch(/bottom-\[\d+px\]/)
      expect(src).not.toContain('animate-attn-glow')
    }
  })

  it('the More sheet is built on the pop-up shell', () => {
    expect(read('components/shell/MoreSheet.tsx')).toMatch(/from '@\/components\/ui\/Modal'/)
  })

  it('bottom nav is a 5-column equal-width grid with safe-area padding', () => {
    const nav = read('components/shell/BottomNav.tsx')
    expect(nav).toContain('grid-cols-5')
    expect(nav).toContain('env(safe-area-inset-bottom)')
  })

  it('the wordmark appears only in the desktop sidebar', () => {
    const header = layout.slice(layout.indexOf('<header'), layout.indexOf('</header>'))
    expect(header).not.toContain('Cycle Circle')
    expect(layout.match(/Cycle Circle/g)?.length).toBe(1)
  })

  it('the Symptoms dot badge is labelled for assistive tech', () => {
    expect(read('components/shell/BottomNav.tsx')).toContain("t('nav.notLoggedToday')")
  })

  it('the tour uses the shell portal, layer and focus utilities', () => {
    const tour = read('components/onboarding/OnboardingTour.tsx')
    expect(tour).toContain('createPortal')
    expect(tour).toContain('Z_CLASS.prompt')
    expect(tour).toContain('nextTrapIndex')
    expect(tour).toContain('tourCardPlacement')
  })
})

describe('phone bars are opaque', () => {
  // .glass compiles (Tailwind v4 / Lightning CSS) to only -webkit-backdrop-filter, so Chromium shows
  // page content through it. The phone header and bottom nav use the opaque card surface instead.
  it('bottom nav uses --color-bg-card, not .glass', () => {
    const nav = read('components/shell/BottomNav.tsx')
    const tag = nav.match(/<nav[\s\S]*?>/)![0]
    expect(tag).toContain('bg-[var(--color-bg-card)]')
    expect(tag).not.toMatch(/\bglass\b/)
  })

  it('phone header uses --color-bg-card, not .glass', () => {
    const layout = read('app/(main)/layout.tsx')
    const tag = layout.match(/<header[\s\S]*?>/)![0]
    expect(tag).toContain('md:hidden')
    expect(tag).toContain('bg-[var(--color-bg-card)]')
    expect(tag).not.toMatch(/\bglass\b/)
  })
})

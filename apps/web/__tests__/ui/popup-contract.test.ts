import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { POPUPS, ADMIN_POPUP_SOURCES } from '../../e2e/support/popup-registry'

const WEB = path.resolve(__dirname, '../../src')
const ADMIN = path.resolve(__dirname, '../../../admin/src')
const E2E_TESTS = path.resolve(__dirname, '../../e2e/tests')

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' || e.name === '.next' ? [] : walk(p)
    return /\.(tsx?|css)$/.test(e.name) ? [p] : []
  })
}
const rel = (root: string, p: string) => path.relative(root, p).split(path.sep).join('/')
const files = (root: string) => walk(root).map((p) => ({ rel: rel(root, p), text: fs.readFileSync(p, 'utf8') }))

const webFiles = files(WEB)
const adminFiles = files(ADMIN)

/** The pop-up shell itself: the only places allowed to render a modal dialog container. */
const SHELL = new Set(['components/ui/Modal.tsx'])
const ADMIN_SHELL = new Set(['components/ui/Modal.tsx', 'components/ui/Drawer.tsx'])
/**
 * Not on the shell, on purpose:
 *  - web OnboardingTour: spotlight overlay anchored to page elements (the page must stay scrollable to reach them).
 *  - admin DateTimePicker: non-modal (aria-modal="false") popover that portals into the enclosing shell pop-up.
 */
const TOUR = 'components/onboarding/OnboardingTour.tsx'
const PICKER = 'components/ui/DateTimePicker.tsx'

const DIALOG_CONTAINER = /role\s*=\s*(?:\{\s*)?["'](?:dialog|alertdialog)["']|<dialog[\s>]|aria-modal\s*=\s*(?:\{\s*true\s*\}|["']true["'])/

describe('pop-up containers live only in the shared shell', () => {
  it('no dialog / alertdialog / modal container in the web app outside the shell', () => {
    const offenders = webFiles.filter((f) => !SHELL.has(f.rel) && f.rel !== TOUR && DIALOG_CONTAINER.test(f.text)).map((f) => f.rel)
    expect(offenders).toEqual([])
  })

  it('no dialog / alertdialog / modal container in the admin app outside the shell', () => {
    const offenders = adminFiles.filter((f) => !ADMIN_SHELL.has(f.rel) && f.rel !== PICKER && DIALOG_CONTAINER.test(f.text)).map((f) => f.rel)
    expect(offenders).toEqual([])
  })

  it('the exemptions stay what they claim to be', () => {
    const tour = webFiles.find((f) => f.rel === TOUR)!.text
    expect(tour).toMatch(/Z_CLASS\.prompt/) // sits on a shell layer
    const picker = adminFiles.find((f) => f.rel === PICKER)!.text
    expect(picker).toMatch(/aria-modal="false"/)
    expect(picker).toMatch(/data-popup-root/)
  })

  it('the shells do render the dialog role', () => {
    expect(webFiles.find((f) => f.rel === 'components/ui/Modal.tsx')!.text).toMatch(DIALOG_CONTAINER)
    expect(adminFiles.find((f) => f.rel === 'components/ui/Modal.tsx')!.text).toMatch(DIALOG_CONTAINER)
  })

  it('the detector flags what it should', () => {
    expect(DIALOG_CONTAINER.test('<div role="dialog" aria-modal="true">')).toBe(true)
    expect(DIALOG_CONTAINER.test("<div role='alertdialog'>")).toBe(true)
    expect(DIALOG_CONTAINER.test('<dialog open>')).toBe(true)
    expect(DIALOG_CONTAINER.test('<div aria-modal={true}>')).toBe(true)
    expect(DIALOG_CONTAINER.test('<div role="status">')).toBe(false)
    expect(DIALOG_CONTAINER.test('aria-haspopup="dialog"')).toBe(false)
  })
})

/**
 * Bottom-nav clearance comes from var(--bottom-nav-h) (0 on desktop). Any pixel/rem or Tailwind-scale offset that
 * stands in for the nav height drifts when the nav changes.
 */
const NAV_OFFSET_BANS: { name: string; re: RegExp }[] = [
  { name: 'arbitrary px/rem bottom offset', re: /(?<![\w-])(?:bottom|pb|mb|scroll-pb|scroll-mb)-\[\d+(?:\.\d+)?(?:px|rem)\]/ },
  { name: 'large scale bottom padding / scroll margin (14-29)', re: /(?<![\w-])(?:pb|scroll-pb|scroll-mb)-(?:1[4-9]|2\d)(?![\w.])/ },
  { name: 'fixed/sticky bottom offset on the scale (14-29)', re: /(?:fixed|sticky)[^\n]*(?<![\w-])bottom-(?:1[4-9]|2\d)(?![\w.])|(?<![\w-])bottom-(?:1[4-9]|2\d)(?![\w.])[^\n]*(?:fixed|sticky)/ },
  { name: 'literal nav height next to safe-area inset', re: /(?:\b(?:56|64|72|80)px|\b3\.5rem|\b4rem|\b5rem)\s*\+\s*env\(safe-area-inset-bottom\)/ },
  { name: 'style bottom in px', re: /\bbottom:\s*['"]?\d+px/ },
]

describe('no hard-coded bottom-nav offsets', () => {
  for (const ban of NAV_OFFSET_BANS) {
    it(`web: ${ban.name}`, () => {
      const offenders = webFiles.filter((f) => ban.re.test(f.text)).map((f) => f.rel)
      expect(offenders).toEqual([])
    })
  }

  it('the detector flags what it should and allows the token', () => {
    expect(NAV_OFFSET_BANS[0].re.test('pb-[80px]')).toBe(true)
    expect(NAV_OFFSET_BANS[1].re.test('className="pb-24"')).toBe(true)
    expect(NAV_OFFSET_BANS[1].re.test('pb-2')).toBe(false)
    expect(NAV_OFFSET_BANS[2].re.test('fixed inset-x-0 bottom-20')).toBe(true)
    expect(NAV_OFFSET_BANS[2].re.test('absolute -bottom-24')).toBe(false)
    expect(NAV_OFFSET_BANS[3].re.test('calc(64px+env(safe-area-inset-bottom))')).toBe(true)
    expect(NAV_OFFSET_BANS[0].re.test('pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+1.5rem)]')).toBe(false)
    expect(NAV_OFFSET_BANS[3].re.test('calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+1.5rem)')).toBe(false)
  })
})

describe('pop-up registry (what the e2e sweep covers)', () => {
  const importsShell = (text: string) => /from ['"](?:@\/components\/ui\/(?:Modal|Drawer)|\.\/(?:Modal|Drawer))['"]/.test(text)

  it('lists every web component that uses the Modal shell', () => {
    const registered = new Set(POPUPS.map((p) => p.source))
    const missing = webFiles
      .filter((f) => !SHELL.has(f.rel) && importsShell(f.text) && !registered.has(f.rel))
      .map((f) => f.rel)
    expect(missing).toEqual([])
  })

  it('lists every admin component that uses the Modal / Drawer shell', () => {
    const missing = adminFiles
      .filter((f) => !ADMIN_SHELL.has(f.rel) && importsShell(f.text) && !ADMIN_POPUP_SOURCES.includes(f.rel))
      .map((f) => f.rel)
    expect(missing).toEqual([])
  })

  it('points every entry at a real source and a real spec', () => {
    for (const p of POPUPS) {
      expect(fs.existsSync(path.join(WEB, p.source)), `${p.id}: source ${p.source}`).toBe(true)
      expect(fs.existsSync(path.join(E2E_TESTS, p.spec)), `${p.id}: spec ${p.spec}`).toBe(true)
      if (p.sameAs) expect(POPUPS.some((q) => q.id === p.sameAs), `${p.id}: sameAs ${p.sameAs}`).toBe(true)
    }
  })

  it('has a sweep case in popup-contract.spec.ts for every entry marked sweep', () => {
    const spec = fs.readFileSync(path.join(E2E_TESTS, 'popup-contract.spec.ts'), 'utf8')
    for (const p of POPUPS.filter((q) => q.sweep)) {
      expect(spec, `sweep case "${p.id}"`).toMatch(new RegExp(`id: '${p.id}'|pop-up contract: ${p.id}`))
    }
  })
})

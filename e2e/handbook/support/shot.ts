/**
 * `shot(page, anchor, opts)`: save a handbook screenshot under docs/handbook/screenshots/.
 *
 * The file name is fixed by docs/handbook/OUTLINE.md: `<anchor>.png`, or `<anchor>--<suffix>.png`
 * for a section with several screens. An anchor the outline does not list throws, and so does a
 * page that is not one of this slot's local apps, so production or real data can never be captured.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Locator, Page } from '@playwright/test'
import { parseOutline } from '../../../scripts/handbook/outline.mjs'
import { REPO_DIR, URLS } from '../../support/slot.ts'

export const SCREENSHOT_DIR = path.join(REPO_DIR, 'docs/handbook/screenshots')
const OUTLINE = path.join(REPO_DIR, 'docs/handbook/OUTLINE.md')

type Device = 'phone' | 'desktop'

function anchors(): Map<string, Device> {
  const out = new Map<string, Device>()
  for (const ch of parseOutline(fs.readFileSync(OUTLINE, 'utf8'))) {
    for (const s of ch.sections) out.set(s.anchor, ch.device as Device)
  }
  return out
}

export interface ShotOptions {
  /** Extra screen of the same section: file becomes `<anchor>--<suffix>.png`. Lower-case words joined by `-`. */
  suffix?: string
  /** Capture only this element instead of the viewport. */
  of?: Locator
  /** Capture the whole scrollable page (long pages such as Terms). */
  fullPage?: boolean
}

export async function shot(page: Page, anchor: string, opts: ShotOptions = {}): Promise<string> {
  const device = anchors().get(anchor)
  if (!device) throw new Error(`"${anchor}" is not an anchor in docs/handbook/OUTLINE.md; add the section there first`)
  const viewport = page.viewportSize()
  if (viewport) {
    const isPhone = viewport.width < 600
    if (isPhone !== (device === 'phone')) throw new Error(`${anchor} is a ${device} section but the page is ${viewport.width}px wide`)
  }
  const origin = new URL(page.url()).origin
  if (![URLS.web, URLS.admin].includes(origin)) throw new Error(`refusing to capture ${origin}: handbook screenshots come only from this slot's local apps`)
  if (opts.suffix !== undefined && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(opts.suffix)) throw new Error(`bad suffix "${opts.suffix}"`)

  const file = path.join(SCREENSHOT_DIR, `${anchor}${opts.suffix ? `--${opts.suffix}` : ''}.png`)
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  await page.evaluate(() => document.fonts.ready)
  // Spring/slide animations (motion library) ignore `animations: 'disabled'`; let them settle.
  await page.waitForTimeout(800)
  const options = { path: file, animations: 'disabled' as const, caret: 'hide' as const }
  if (opts.of) await opts.of.screenshot(options)
  else await page.screenshot({ ...options, fullPage: opts.fullPage ?? false })
  return file
}

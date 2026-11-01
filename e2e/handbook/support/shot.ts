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
import { pngPixelsEqual } from '../../support/png-equal.ts'
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
  /**
   * The device this one shot is taken at, when it differs from the chapter's device in OUTLINE.md
   * (for example a desktop sidebar in a phone chapter). The page's viewport must match it.
   */
  device?: Device
}

export async function shot(page: Page, anchor: string, opts: ShotOptions = {}): Promise<string> {
  const outlineDevice = anchors().get(anchor)
  if (!outlineDevice) throw new Error(`"${anchor}" is not an anchor in docs/handbook/OUTLINE.md; add the section there first`)
  const device = opts.device ?? outlineDevice
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
  // Streamed pages show a loading skeleton until their data lands; the network going quiet means it has.
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined)
  // Spring/slide animations (motion library) ignore `animations: 'disabled'`: wait until the finite Web Animations
  // have finished and the open dialog or sheet (if any) and the scroll position have held still for 12 frames. Promise/rAF based, bounded on
  // the Node side. Under a paused fake clock (page.clock.install) neither progresses; the screenshot's own
  // `animations: 'disabled'` then finishes the finite ones, so running out of time here is not an error.
  await Promise.race([
    page.evaluate(async () => {
      await Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))
      const moving = () =>
        JSON.stringify([
          document.querySelector('[role="dialog"]')?.getBoundingClientRect() ?? null,
          window.scrollX,
          window.scrollY,
          document.scrollingElement?.scrollLeft,
          document.scrollingElement?.scrollTop,
        ])
      let last = moving()
      for (let still = 0; still < 12; ) {
        await new Promise((r) => requestAnimationFrame(r))
        const now = moving()
        still = now === last ? still + 1 : 0
        last = now
      }
    }),
    new Promise((resolve) => setTimeout(resolve, 3_000)),
  ])
  const options = { animations: 'disabled' as const, caret: 'hide' as const }
  const take = () => (opts.of ? opts.of.screenshot(options) : page.screenshot({ ...options, fullPage: opts.fullPage ?? false }))
  // JS-driven entrance animations (cards growing, chart bars rising) are invisible to the checks above, so keep
  // shooting until two shots 250 ms apart are byte-identical (at most 12 tries). Node-side waits are clock-safe.
  let png = await take()
  for (let i = 0; i < 12; i++) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    const next = await take()
    const same = png.equals(next)
    png = next
    if (same) break
  }
  // Keep the committed file when the pixels are the same, so reruns leave no diff.
  if (!fs.existsSync(file) || !pngPixelsEqual(fs.readFileSync(file), png)) fs.writeFileSync(file, png)
  return file
}

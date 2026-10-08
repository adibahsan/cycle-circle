/**
 * Screenshot script. ORCHESTRATOR-RUN ONLY (needs the DB and a port).
 *
 *   pnpm --filter @vesta/web e2e:shots --route /dashboard
 *   pnpm --filter @vesta/web e2e:shots --route /dashboard --popup period-log
 *   pnpm --filter @vesta/web e2e:shots --route /dashboard --mock trial-expired --label trial-expired
 *   pnpm --filter @vesta/web e2e:shots --route /onboarding --persona fresh --themes dark --viewports phone-375
 *
 * Flags: --route (required) --popup <name> --mock a,b --persona seed|fresh
 *        --themes light,dark --viewports desktop,phone-375,phone-390 --label <name> --full-page
 * Named pop-ups: e2e/support/popups.ts. Named mocks: e2e/support/mocks.ts.
 * Output (gitignored): <repo>/review/screenshots/e2e/<label>/<label>-<theme>-<viewport>.png
 * Set E2E_BASE_URL to reuse a running server instead of starting one.
 */
import { chromium, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { parseShotArgs } from '../support/args'
import { saveLoginState } from '../support/auth'
import { applyCompletionMock, applyLoggingMock, applyStatusMock } from '../support/mocks'
import { POPUPS } from '../support/popups'
import { startDevServer } from '../support/server'
import { planShots, VIEWPORTS } from '../support/shot-plan'

const OUT_ROOT = path.resolve(__dirname, '../../../../review/screenshots/e2e')

async function settle(page: Page, ms = 1500) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  await page.waitForTimeout(ms)
}

async function main() {
  const args = parseShotArgs(process.argv.slice(2))
  const server = process.env.E2E_BASE_URL ? null : await startDevServer()
  const baseURL = process.env.E2E_BASE_URL ?? server!.baseURL
  const outDir = path.join(OUT_ROOT, args.label)
  fs.mkdirSync(outDir, { recursive: true })
  try {
    const storageState = await saveLoginState(baseURL, args.persona)
    const browser = await chromium.launch()
    for (const shot of planShots({ label: args.label, themes: args.themes, viewports: args.viewports })) {
      const isPhone = shot.viewport !== 'desktop'
      const ctx = await browser.newContext({
        baseURL, storageState, viewport: VIEWPORTS[shot.viewport], colorScheme: shot.theme,
        isMobile: isPhone, hasTouch: isPhone,
      })
      await ctx.addInitScript(`try{const k='vesta-store';const s=JSON.parse(localStorage.getItem(k)||'{"state":{},"version":0}');s.state.theme='${shot.theme}';s.state.language='en';localStorage.setItem(k,JSON.stringify(s))}catch(e){}`)
      const page = await ctx.newPage()
      if (!args.popup) {
        // A named pop-up is the subject; otherwise keep auto prompts out of the base page.
        await page.addInitScript(`try{const o=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(this===window.localStorage&&typeof k==='string'&&k.indexOf('vesta_prompt_last:')===0)return String(Date.now());return o.call(this,k)}}catch(e){}`)
      }
      if (args.mocks.length) {
        await page.route('**/api/auth/status', async (route) => {
          const res = await route.fetch()
          await route.fulfill({ response: res, json: applyStatusMock(await res.json(), args.mocks) })
        })
        await page.route('**/api/profile/completion', async (route) => {
          const res = await route.fetch()
          await route.fulfill({ response: res, json: applyCompletionMock(await res.json(), args.mocks) })
        })
        await page.route('**/api/tracking/logging-status', async (route) => {
          const res = await route.fetch()
          await route.fulfill({ response: res, json: applyLoggingMock(await res.json(), args.mocks) })
        })
      }
      await page.goto(args.route)
      await settle(page, args.mocks.length ? 3000 : 2000)
      if (args.popup) {
        let opened = false
        for (const sel of POPUPS[args.popup].triggers) {
          const loc = page.locator(sel).first()
          try {
            await loc.waitFor({ state: 'visible', timeout: 4000 })
            await loc.click()
            opened = true
            break
          } catch {}
        }
        if (!opened) console.warn(`NOTRIGGER ${args.popup} at ${shot.viewport}/${shot.theme}`)
        await page.waitForTimeout(1200)
      }
      const file = path.join(outDir, shot.file)
      await page.screenshot({ path: file, fullPage: args.fullPage })
      console.log('shot', path.relative(process.cwd(), file))
      await ctx.close()
    }
    await browser.close()
  } finally {
    await server?.stop()
  }
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1) })

import type { Page } from '@playwright/test'
import { test, expect } from '../../support/fixtures'
import { createLoggedInAdmin } from '../../support/admin'
import { e2eDb } from '../../support/db'

/**
 * Parse a StatCard value as an exact integer.
 * E2E DB stays under 1000 users, so the UI must show the raw count — not "1.2K"/"1.0M".
 */
function parseExactStatInteger(display: string, label: string): number {
  const trimmed = display.trim()
  if (/[KkMm]/.test(trimmed) || trimmed.includes('.')) {
    throw new Error(
      `${label} display is abbreviated ("${trimmed}"); expected an exact integer (< 1000 users in E2E)`,
    )
  }
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${label} display is not an exact integer: "${trimmed}"`)
  }
  return Number.parseInt(trimmed, 10)
}

/**
 * StatCard value sits in the `<p>` after the title row.
 * No role/name or data-testid on the value (a11y gap #135).
 */
async function readStatCardValue(page: Page, title: string): Promise<string> {
  return page.getByText(title, { exact: true }).evaluate((titleEl) => {
    const titleRow = titleEl.parentElement
    const valueEl = titleRow?.nextElementSibling
    if (valueEl && valueEl.tagName === 'P') return valueEl.textContent?.trim() ?? ''
    const card = titleEl.parentElement?.parentElement
    if (!card) return ''
    const paragraphs = Array.from(card.querySelectorAll('p'))
    return paragraphs.find((p) => p !== titleEl)?.textContent?.trim() ?? ''
  })
}

async function readExactStat(page: Page, title: string): Promise<number> {
  const text = await readStatCardValue(page, title)
  expect(text.length).toBeGreaterThan(0)
  return parseExactStatInteger(text, title)
}

/** Click Refresh data and wait for the revalidate + router.refresh transition to finish. */
async function refreshDashboard(page: Page): Promise<void> {
  const btn = page.getByRole('button', { name: 'Refresh data' })
  await btn.click()
  await expect(btn).toBeEnabled({ timeout: 15_000 })
}

/**
 * Soft-delete oldest throwaway E2E users so Total Users stays an exact integer (< 1000).
 * Never touches seeded personas (017… phones / non-@e2e.vesta.test emails).
 * Prefer users older than 2 minutes so parallel workers' fresh creates survive.
 */
async function ensureExactTotalUsersHeadroom(maxActive = 850): Promise<void> {
  const db = e2eDb()
  const active = await db.user.count({ where: { deletedAt: null } })
  if (active < maxActive) return

  const need = active - maxActive + 1
  const throwawayWhere = {
    deletedAt: null as null,
    OR: [{ phone: { startsWith: '+880136' } }, { email: { endsWith: '@e2e.vesta.test' } }],
  }

  const olderThan = new Date(Date.now() - 120_000)
  let ids = (
    await db.user.findMany({
      where: { ...throwawayWhere, createdAt: { lt: olderThan } },
      orderBy: { createdAt: 'asc' },
      take: need,
      select: { id: true },
    })
  ).map((u) => u.id)

  if (ids.length < need) {
    const more = await db.user.findMany({
      where: ids.length ? { ...throwawayWhere, id: { notIn: ids } } : throwawayWhere,
      orderBy: { createdAt: 'asc' },
      take: need - ids.length,
      select: { id: true },
    })
    ids = ids.concat(more.map((u) => u.id))
  }

  if (ids.length === 0) {
    throw new Error(
      `Total Users is ${active} but no throwaway users to soft-delete; cannot keep exact integer display`,
    )
  }

  await db.user.updateMany({
    where: { id: { in: ids } },
    data: { deletedAt: new Date() },
  })
}

/** Today's signup bucket using the same UTC day key as getUserTrend. */
async function todaySignupBucketCount(): Promise<number> {
  const todayKey = new Date().toISOString().split('T')[0]
  const start = new Date(`${todayKey}T00:00:00.000Z`)
  const end = new Date(`${todayKey}T23:59:59.999Z`)
  return e2eDb().user.count({
    where: { deletedAt: null, createdAt: { gte: start, lte: end } },
  })
}

test.describe('Admin dashboard', () => {
  test('KPIs and the signup trend reflect users created in the run', async ({
    browser,
    newUser,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    const admin = await createLoggedInAdmin(browser, {
      viewport,
      userAgent,
      isMobile,
      hasTouch,
      deviceScaleFactor,
      locale,
      timezoneId,
    })
    const { page } = admin

    try {
      // Keep Total Users < 1000 so the StatCard shows an exact integer (not "1.1K").
      await ensureExactTotalUsersHeadroom()

      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

      // Snapshot UI before creates — refresh until cache drops abbreviated totals.
      let beforeTotal = -1
      await expect
        .poll(
          async () => {
            await refreshDashboard(page)
            try {
              beforeTotal = await readExactStat(page, 'Total Users')
              return beforeTotal
            } catch {
              return -1
            }
          },
          { timeout: 20_000 },
        )
        .toBeGreaterThanOrEqual(0)

      const beforeToday = await todaySignupBucketCount()

      // Throwaway web users (real OTP) — never the seeded read-only personas.
      await newUser()
      await newUser()

      const afterToday = await todaySignupBucketCount()
      expect(afterToday).toBeGreaterThanOrEqual(beforeToday + 2)

      // Parallel-safe: refresh until UI is at least before+2 (monotonic ≥, not exact DB match).
      await expect
        .poll(
          async () => {
            await refreshDashboard(page)
            return readExactStat(page, 'Total Users')
          },
          { timeout: 20_000 },
        )
        .toBeGreaterThanOrEqual(beforeTotal + 2)

      await expect(page.getByRole('heading', { name: 'New Signups' })).toBeVisible()
      await expect(page.getByText('Daily new user registrations — last 30 days')).toBeVisible()
      // Recharts AreaChart exposes no accessible per-day counts (#135); today's bucket is
      // asserted via the same User.createdAt day grouping the chart reads (see COVERAGE.md A02).
      expect(afterToday - beforeToday).toBeGreaterThanOrEqual(2)
    } finally {
      await admin.context.close()
    }
  })
})

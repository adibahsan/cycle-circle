/**
 * Handbook chapter "Profiles" (docs/handbook/chapters/profiles.md), ticket #243.
 * Demo Users only (fake names, fake phones); nothing here touches the seeded personas.
 */
import type { BrowserContext, Page } from '@playwright/test'
import { test, expect } from '../../../support/fixtures.ts'
import { suppressAutoPrompts } from '../../../support/prompts.ts'
import { demoPhoneUser } from '../../support/demo-users.ts'
import { shot } from '../../support/shot.ts'

const PHONES = { family: '01711223361', full: '01711223362' } as const

async function addProfile(context: BrowserContext, data: { name: string; relation: string; ago: string; cycleLength?: number; periodLength?: number }) {
  const res = await context.request.post('/api/profiles', {
    data: { name: data.name, relation: data.relation, cycleLength: data.cycleLength ?? 28, periodLength: data.periodLength ?? 5, lastPeriodStart: data.ago, goal: 'tracking' },
  })
  expect(res.status(), await res.text()).toBe(201)
}

async function scrollToText(page: Page, text: string) {
  await page.getByText(text, { exact: true }).first().evaluate((el) => el.scrollIntoView({ block: 'start' }))
}

test.describe('Profiles', () => {
  test('list, add, relationship types, edit, delete, switch, completion', async ({ browser, days }, testInfo) => {
    const context = await demoPhoneUser(browser, testInfo.project.use, PHONES.family)
    try {
      await addProfile(context, { name: 'Rina', relation: 'SELF', ago: days.daysAgo(10) })
      await addProfile(context, { name: 'Nusrat', relation: 'SISTER', ago: days.daysAgo(20), cycleLength: 30, periodLength: 4 })
      const page = await context.newPage()
      await suppressAutoPrompts(page)

      // Open Profiles from the header chip, as a User does: the Dashboard has set the active profile by then.
      await page.goto('/dashboard')
      await expect(page.getByText('Hello, Rina')).toBeVisible()
      await page.getByRole('link', { name: /^Profiles — Rina/ }).filter({ visible: true }).first().click()
      await expect(page.getByRole('heading', { name: 'My Profiles' })).toBeVisible()
      await expect(page.getByText('Active', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Switch to Nusrat' })).toBeVisible()
      await shot(page, 'pf-list')

      await page.getByRole('button', { name: /^Add Profile/ }).click()
      await expect(page.getByLabel('Name', { exact: false }).first()).toBeVisible()
      await shot(page, 'pf-add')

      await scrollToText(page, 'Relation')
      await shot(page, 'pf-relations')

      await page.getByLabel(/^Name/).first().fill('Amma')
      await page.getByRole('button', { name: 'Mother' }).click()
      await page.getByLabel(/Last period start/).fill(days.daysAgo(15))
      await page.getByRole('button', { name: 'Create Profile' }).click()
      await expect(page.getByRole('button', { name: 'Switch to Amma' })).toBeVisible()

      await page.getByRole('button', { name: 'Edit Profile Nusrat' }).click()
      const edit = page.getByRole('dialog', { name: 'Edit Profile' })
      await expect(edit).toBeVisible()
      await shot(page, 'pf-edit')
      await edit.getByRole('button', { name: 'Cancel' }).click()
      await expect(edit).not.toBeVisible()

      await page.getByRole('button', { name: 'Delete Nusrat' }).click()
      const del = page.getByRole('dialog', { name: 'Remove profile' })
      await expect(del).toBeVisible()
      await shot(page, 'pf-delete')
      await del.getByRole('button', { name: 'Cancel' }).click()
      await expect(del).not.toBeVisible()

      await page.getByRole('button', { name: 'Switch to Nusrat' }).click()
      await expect(page).toHaveURL(/\/dashboard/)
      await shot(page, 'pf-switch', { suffix: 'dashboard' })
      await page.getByRole('link', { name: /^Profiles — Nusrat/ }).filter({ visible: true }).first().click()
      await expect(page.getByText('Active', { exact: true })).toBeVisible()
      await shot(page, 'pf-switch')

      const ring = page.getByRole('button', { name: /Profile \d+% complete/ }).filter({ visible: true }).first()
      await expect(ring).toBeVisible()
      await shot(page, 'pf-completion', { suffix: 'header-ring' })
      await ring.click()
      await expect(page.getByRole('dialog', { name: 'Complete Your Profile' })).toBeVisible()
      await shot(page, 'pf-completion')
    } finally {
      await context.close()
    }
  })

  test('six-profile limit and the add that loses the race', async ({ browser, days }, testInfo) => {
    const context = await demoPhoneUser(browser, testInfo.project.use, PHONES.full)
    try {
      const names = ['Rina', 'Nusrat', 'Amma', 'Tania', 'Mitu', 'Shapla']
      const rel = ['SELF', 'SISTER', 'MOTHER', 'DAUGHTER', 'WIFE', 'GIRLFRIEND']
      for (let i = 0; i < 5; i++) await addProfile(context, { name: names[i], relation: rel[i], ago: days.daysAgo(5 + i) })
      const page = await context.newPage()
      await suppressAutoPrompts(page)
      await page.goto('/dashboard')
      await page.getByRole('link', { name: /^Profiles — Rina/ }).filter({ visible: true }).first().click()
      await expect(page.getByText('1 slot remaining')).toBeVisible()
      // Another device adds the sixth while this page still shows five.
      await addProfile(context, { name: names[5], relation: rel[5], ago: days.daysAgo(11) })
      await page.getByRole('button', { name: /^Add Profile/ }).click()
      await page.getByLabel(/^Name/).first().fill('Extra')
      await page.getByLabel(/Last period start/).fill(days.daysAgo(3))
      await page.getByRole('button', { name: 'Create Profile' }).click()
      await expect(page.getByRole('alert').filter({ hasText: /\S/ }).first()).toBeVisible()
      console.log('LIMIT-RACE-MESSAGE:', await page.getByRole('alert').first().innerText())
      await shot(page, 'pf-limit', { suffix: 'server-error' })

      await page.reload()
      await expect(page.getByText('Maximum 6 profiles')).toBeVisible()
      await expect(page.getByText('Delete a profile to add a new one')).toBeVisible()
      await shot(page, 'pf-limit')
    } finally {
      await context.close()
    }
  })
})

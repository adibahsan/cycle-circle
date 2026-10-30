/**
 * Seeded read-only personas (support/personas.ts): each opens its main pages from the storage
 * state that global setup saved, and shows its own seeded content. Strictly read-only: no
 * clicks that save, no profile switching, nothing that writes to the persona's rows.
 */
import { test, expect } from '../../support/fixtures.ts'
import { PERSONAS, statePath, type PersonaName } from '../../support/personas.ts'
import { suppressAutoPrompts } from '../../support/prompts.ts'

const EXPECTED: Record<PersonaName, { profiles: string[]; streak?: RegExp }> = {
  streaker: { profiles: ['Rina'], streak: /\d+-day symptom streak/ },
  allGood: { profiles: ['Sultana'], streak: /\d+-day symptom streak/ },
  stale: { profiles: ['Nasrin'] },
  power: { profiles: ['Farida'] },
  newUser: { profiles: ['Mitu'] },
  proMulti: { profiles: ['Roksana (Self)', 'Prity (Wife)', 'Sadia (Daughter)'] },
}

for (const name of Object.keys(PERSONAS) as PersonaName[]) {
  test.describe(`persona ${name}`, () => {
    test.use({ storageState: statePath(name) })
    const { profiles, streak } = EXPECTED[name]

    test('lists its own seeded profiles', async ({ page }) => {
      await suppressAutoPrompts(page)
      await page.goto('/profiles')
      await expect(page.getByRole('heading', { name: 'Profiles' })).toBeVisible()
      for (const profile of profiles) {
        await expect(page.getByRole('button', { name: `Switch to ${profile}` })).toBeVisible()
      }
      await expect(page.getByRole('button', { name: /^Edit Profile / })).toHaveCount(profiles.length)
    })

    if (streak) {
      test('dashboard shows its symptom streak', async ({ page }) => {
        await suppressAutoPrompts(page)
        await page.goto('/dashboard')
        await expect(page.getByText(streak).first()).toBeVisible({ timeout: 15_000 })
      })
    }
  })
}

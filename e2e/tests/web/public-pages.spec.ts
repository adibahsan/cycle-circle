import { test, expect } from '../../support/fixtures.ts'

test.describe('Public Marketing and Onboarding Pages', () => {
  // Use a fresh browser context without logged-in session cookies
  test.use({ storageState: { cookies: [], origins: [] } })

  test('welcome page loads, root redirects to welcome when logged out, and CTAs lead to get-started and login (W55)', async ({ page }) => {
    // 1. Root redirects to /welcome
    await page.goto('/')
    await expect(page).toHaveURL(/\/welcome/)

    // 2. Hero elements are visible
    await expect(page.getByRole('heading', { level: 1, name: 'Your cycle, understood' })).toBeVisible()

    // 3. CTA to Get Started works
    const getStartedLink = page.getByRole('link', { name: 'Get Started' }).first()
    await expect(getStartedLink).toBeVisible()
    await getStartedLink.click()
    await expect(page).toHaveURL(/\/get-started/)

    // 4. Return to /welcome and verify Sign In CTA works
    await page.goto('/welcome')
    const loginLink = page.getByRole('link', { name: /Log In|Sign In/i }).first()
    await expect(loginLink).toBeVisible()
    await loginLink.click()
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByLabel('Phone Number')).toBeVisible()

    // 5. Footer links to /privacy and /terms work
    await page.goto('/welcome')
    const footerNav = page.locator('footer')
    await footerNav.getByRole('link', { name: 'Privacy' }).click()
    await expect(page).toHaveURL(/\/privacy/)

    await page.goto('/welcome')
    await footerNav.getByRole('link', { name: 'Terms' }).click()
    await expect(page).toHaveURL(/\/terms/)
  })

  test('privacy page loads with legal sections, contact info, and navigation links (W56)', async ({ page }) => {
    await page.goto('/privacy')

    // Page title and intro
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible()
    await expect(page.getByText('Last updated:')).toBeVisible()
    await expect(page.getByRole('main').getByRole('link', { name: 'info@cycle-circle.com' })).toBeVisible()

    // Key legal sections
    await expect(page.getByRole('heading', { name: 'Data Collection' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'How We Use Your Data' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Data Storage' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Data Isolation (Multi-Profile)' })).toBeVisible()

    // Header link navigates home
    const headerHomeLink = page.locator('header').getByRole('link', { name: 'Cycle Circle' })
    await headerHomeLink.click()
    await expect(page).toHaveURL(/\/welcome|\/$/)

    // Footer links to Terms and Login
    await page.goto('/privacy')
    const footer = page.locator('footer')
    await footer.getByRole('link', { name: 'Terms' }).click()
    await expect(page).toHaveURL(/\/terms/)

    await page.goto('/privacy')
    await page.locator('footer').getByRole('link', { name: /Log In/i }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('terms page loads with legal sections, medical disclaimer, and navigation links (W57)', async ({ page }) => {
    await page.goto('/terms')

    // Page title and intro
    await expect(page.getByRole('heading', { level: 1, name: 'Terms & Conditions' })).toBeVisible()
    await expect(page.getByText('Effective:')).toBeVisible()
    await expect(page.getByRole('main').getByRole('link', { name: 'info@cycle-circle.com' })).toBeVisible()

    // Key sections including medical disclaimer
    await expect(page.getByRole('heading', { name: 'Acceptance of Terms' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Service Description' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Limitations & Disclaimer' })).toBeVisible()

    // Header link navigates home
    const headerHomeLink = page.locator('header').getByRole('link', { name: 'Cycle Circle' })
    await headerHomeLink.click()
    await expect(page).toHaveURL(/\/welcome|\/$/)

    // Footer link to Privacy
    await page.goto('/terms')
    await page.locator('footer').getByRole('link', { name: 'Privacy' }).click()
    await expect(page).toHaveURL(/\/privacy/)
  })

  test('get-started onboarding flow loads, steps progress forwards and backwards, and leads into login (W58)', async ({ page }) => {
    await page.goto('/get-started')

    // Step 1
    await expect(page.getByText('1 / 5')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Track with ease' })).toBeVisible()

    // Back button is disabled on step 1
    const backBtn = page.getByRole('button', { name: 'Back' })
    await expect(backBtn).toBeDisabled()

    // Next step -> Step 2
    const nextBtn = page.getByRole('button', { name: /Next/i })
    await nextBtn.click()
    await expect(page.getByText('2 / 5')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Smart predictions' })).toBeVisible()
    await expect(backBtn).toBeEnabled()

    // Back step -> Step 1
    await backBtn.click()
    await expect(page.getByText('1 / 5')).toBeVisible()

    // Progress through remaining steps: 1 -> 2 -> 3 -> 4 -> 5
    await nextBtn.click() // -> 2
    await expect(page.getByText('2 / 5')).toBeVisible()
    await nextBtn.click() // -> 3
    await expect(page.getByText('3 / 5')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Private & encrypted' })).toBeVisible()
    await nextBtn.click() // -> 4
    await expect(page.getByText('4 / 5')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Up to 6 profiles' })).toBeVisible()
    await nextBtn.click() // -> 5
    await expect(page.getByText('5 / 5')).toBeVisible()

    // On final step (step 5), Next button is hidden
    await expect(nextBtn).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Ready to begin?' })).toBeVisible()

    // Final CTA button leads to /login
    const finalCta = page.getByRole('link', { name: 'Get Started' })
    await expect(finalCta).toBeVisible()
    await finalCta.click()
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByLabel('Phone Number')).toBeVisible()

    // Test Skip link from get-started leads directly to /login
    await page.goto('/get-started')
    await expect(page.getByText('1 / 5')).toBeVisible()
    const skipLink = page.getByRole('link', { name: 'Skip' })
    await expect(skipLink).toBeVisible()
    await skipLink.click()
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByLabel('Phone Number')).toBeVisible()
  })
})

import { test, expect } from '../../support/fixtures'
import { SECRETS, URLS } from '../../support/slot.ts'
import { e2eDb } from '../../support/db'
import { toDbPhone } from '../../support/users'
import { createLoggedInAdmin } from '../../support/admin'

/**
 * The route slug is historical: today the job calls `/subscription/getStatus` for
 * each BDApps PRO subscriber (see route comment). Spec #114 / ticket #132 AC say
 * "balances"; reconcile in https://github.com/adibahsan/cycle-circle/issues/142.
 * We assert the live behaviour (status checks + UNREGISTERED → Free) against the fake.
 */
const creds = { applicationId: SECRETS.bdappsAppId, password: SECRETS.bdappsPassword }

async function merchant(fakeUrl: string, path: string, body: Record<string, unknown>) {
  const res = await fetch(new URL(path, fakeUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...creds, ...body }),
  })
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

test.describe('cron: caas-check', () => {
  test('reads subscription status from the fake BDApps for a throwaway Pro user', async ({
    newUser,
    fakeBdapps,
    request,
  }) => {
    const { phone } = await newUser()
    const maskedId = (await fakeBdapps.subscriber(phone))!.maskedId
    const sinceSeq = (await fakeBdapps.calls()).at(-1)?.seq ?? 0

    const res = await request.post(`${URLS.web}/api/cron/caas-check`, {
      headers: { authorization: `Bearer ${SECRETS.cronSecret}` },
      data: { overrideDisabled: true },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.skipped).not.toBe(true)
    expect(typeof body.checked).toBe('number')
    expect(body.checked).toBeGreaterThanOrEqual(1)

    const statusCalls = await fakeBdapps.calls({ path: '/subscription/getStatus', sinceSeq })
    expect(statusCalls.some((c) => c.body.subscriberId === maskedId)).toBe(true)
  })

  test('downgrades a throwaway Pro user when fake BDApps returns UNREGISTERED', async ({
    newUser,
    fakeBdapps,
    request,
  }) => {
    const { phone, page } = await newUser()
    const maskedId = (await fakeBdapps.subscriber(phone))!.maskedId

    // Flip BDApps only (DB stays PRO) so the nightly status check must downgrade.
    const unreg = await merchant(fakeBdapps.baseUrl, '/subscription/send', {
      subscriberId: maskedId,
      action: '0',
    })
    expect(unreg.json).toMatchObject({ statusCode: 'S1000', subscriptionStatus: 'UNREGISTERED' })
    expect(await fakeBdapps.subscriber(phone)).toMatchObject({ status: 'UNREGISTERED' })
    expect((await (await page.request.get('/api/auth/status')).json()).user).toMatchObject({
      subscriptionStatus: 'PRO',
    })

    const res = await request.post(`${URLS.web}/api/cron/caas-check`, {
      headers: { authorization: `Bearer ${SECRETS.cronSecret}` },
      data: { overrideDisabled: true },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.skipped).not.toBe(true)
    expect(body.downgraded).toBeGreaterThanOrEqual(1)

    expect((await (await page.request.get('/api/auth/status')).json()).user).toMatchObject({
      subscriptionStatus: 'FREE',
    })

    // The run is recorded with the user it moved, under their masked subscriber id.
    expect(typeof body.runId).toBe('string')
    const user = await e2eDb().user.findUniqueOrThrow({ where: { phone: toDbPhone(phone) } })
    const run = await e2eDb().subscriptionCheckRun.findUniqueOrThrow({
      where: { id: body.runId },
      include: { outcomes: true },
    })
    expect(run).toMatchObject({ status: 'OK', trigger: 'MANUAL' })
    expect(run.outcomes.find((o) => o.userId === user.id)).toMatchObject({
      outcome: 'MOVED_TO_FREE',
      maskedSubscriberId: expect.stringMatching(/^tel:/),
    })
    expect(
      await e2eDb().subscription.findFirstOrThrow({ where: { userId: user.id } }),
    ).toMatchObject({ lastReportedStatus: 'UNREGISTERED' })
  })

  test('a scheduled run (no override) is recorded as a cron run', async ({ request }) => {
    const res = await request.post(`${URLS.web}/api/cron/caas-check`, {
      headers: { authorization: `Bearer ${SECRETS.cronSecret}` },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    const run = await e2eDb().subscriptionCheckRun.findUniqueOrThrow({ where: { id: body.runId } })
    expect(run.trigger).toBe('CRON')
    expect(['OK', 'SKIPPED']).toContain(run.status)
  })

  // Serial `cron` project: nothing else writes runs now, so the newest run is the one made here.
  test('the admin Subscriptions strip shows the latest run, and warns when the latest run failed or was skipped', async ({
    browser,
    newUser,
    request,
  }) => {
    await newUser()
    const res = await request.post(`${URLS.web}/api/cron/caas-check`, {
      headers: { authorization: `Bearer ${SECRETS.cronSecret}` },
      data: { overrideDisabled: true },
    })
    const body = await res.json()
    const inserted: string[] = []
    const admin = await createLoggedInAdmin(browser)
    try {
      const { page } = admin
      const strip = page.getByTestId('check-strip')

      await page.goto('/subscriptions')
      await expect(strip).toHaveAttribute('data-state', 'ok')
      await expect(page.getByTestId('check-strip-checked')).toHaveText(String(body.checked))
      await expect(page.getByTestId('check-strip-moved')).toHaveText(String(body.downgraded))
      await expect(page.getByTestId('check-strip-errors')).toHaveText('0')
      await expect(strip).toContainText('Bangladesh time')
      await expect(page.getByTestId('check-strip-warning')).toHaveCount(0)
      await expect(page.getByText(/caas/i)).toHaveCount(0)

      const failed = await e2eDb().subscriptionCheckRun.create({
        data: { startedAt: new Date(Date.now() + 60_000), trigger: 'CRON', status: 'FAILED', error: 'boom' },
      })
      inserted.push(failed.id)
      await page.reload()
      await expect(strip).toHaveAttribute('data-state', 'failed')
      await expect(page.getByTestId('check-strip-warning')).toContainText('failed')

      const skipped = await e2eDb().subscriptionCheckRun.create({
        data: { startedAt: new Date(Date.now() + 120_000), trigger: 'CRON', status: 'SKIPPED' },
      })
      inserted.push(skipped.id)
      await page.reload()
      await expect(strip).toHaveAttribute('data-state', 'skipped')
      await expect(page.getByTestId('check-strip-warning')).toContainText('skipped')
      await expect(page.getByTestId('check-strip-checked')).toHaveCount(0)
    } finally {
      await e2eDb().subscriptionCheckRun.deleteMany({ where: { id: { in: inserted } } })
      await admin.context.close()
    }
  })
})

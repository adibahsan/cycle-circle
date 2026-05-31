import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@vesta/shared/server/adapters/webhooks', () => ({
  validateWebhookSource: vi.fn(),
  persistWebhookEvent: vi.fn(),
}))

import { POST } from '../../../../../src/app/api/webhooks/caas/notify/route'
import * as webhooks from '@vesta/shared/server/adapters/webhooks'

function makeRequest() {
  return new Request('http://localhost/api/webhooks/caas/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      externalTrxId: 'trx-123',
      internalTrxId: 'int-456',
      referenceId: 'ref-789',
      timeStamp: '20260531010101',
      statusCode: 'S1000',
      statusDetail: 'Success.',
    }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('POST /api/webhooks/caas/notify', () => {
  it('persists the webhook and returns the BDApps acknowledgment payload', async () => {
    vi.mocked(webhooks.validateWebhookSource).mockReturnValue(true)
    vi.mocked(webhooks.persistWebhookEvent).mockResolvedValue({
      duplicate: false,
      event: { id: 'event-1' },
    } as never)

    const response = await POST(makeRequest())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      statusCode: 'S1000',
      statusDetail: 'Received',
    })
    expect(webhooks.validateWebhookSource).toHaveBeenCalledTimes(1)
    expect(webhooks.persistWebhookEvent).toHaveBeenCalledWith(
      'CAAS_NOTIFY',
      expect.objectContaining({
        externalTrxId: 'trx-123',
      }),
      'caas:trx-123',
    )
  })

  it('rejects requests from unknown webhook sources', async () => {
    vi.mocked(webhooks.validateWebhookSource).mockReturnValue(false)

    const response = await POST(makeRequest())

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: {
        message: 'Forbidden: unknown webhook source',
        code: 'FORBIDDEN',
      },
    })
    expect(webhooks.persistWebhookEvent).not.toHaveBeenCalled()
  })
})

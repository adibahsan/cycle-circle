import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MOCK_AUTH_USER } from '../../helpers/mock-auth'
import { ApiError } from '@vesta/shared/server/api-error'

vi.mock('@vesta/shared/server/middleware', () => ({
  withAuth: (handler: unknown) => handler,
}))
vi.mock('@vesta/shared/server/services', () => ({
  createCaasTransaction: vi.fn(),
  updateCaasTransaction: vi.fn(),
  upsertProSubscription: vi.fn(),
  markUserPro: vi.fn(),
}))
vi.mock('@vesta/shared/server/adapters/bdapps', () => ({
  caasDirectDebit: vi.fn(),
  subscriptionGetStatus: vi.fn(),
  subscriptionSend: vi.fn(),
}))

import { POST } from '../../../src/app/api/billing/subscribe/route'
import * as services from '@vesta/shared/server/services'
import * as bdapps from '@vesta/shared/server/adapters/bdapps'

const request = () =>
  new Request('http://localhost/api/billing/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 5 }),
  })

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('trx-1')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('POST /api/billing/subscribe', () => {
  it('charges immediately when the subscriber is already registered', async () => {
    vi.mocked(bdapps.subscriptionGetStatus)
      .mockResolvedValueOnce({
        statusCode: 'S1000',
        statusDetail: 'Request was successfully processed',
        subscriptionStatus: 'REGISTERED',
        subscriberId: 'tel:+8801700000000',
      } as never)
    vi.mocked(bdapps.caasDirectDebit).mockResolvedValue({
      statusCode: 'S1000',
      externalTrxId: 'trx-1',
      internalTrxId: 'internal-1',
      referenceId: 'ref-1',
      timeStamp: '20260531010101',
    } as never)
    vi.mocked(services.createCaasTransaction).mockResolvedValue({
      id: 'caas-1',
    } as never)
    vi.mocked(services.upsertProSubscription).mockResolvedValue({
      id: 'sub-1',
    } as never)
    vi.mocked(services.updateCaasTransaction).mockResolvedValue({
      id: 'caas-1',
    } as never)
    vi.mocked(services.markUserPro).mockResolvedValue({} as never)

    const response = await POST(request(), { user: MOCK_AUTH_USER } as never)

    expect(response.status).toBe(201)
    expect(bdapps.subscriptionGetStatus).toHaveBeenCalledWith(MOCK_AUTH_USER.phone)
    expect(bdapps.subscriptionSend).not.toHaveBeenCalled()
    expect(services.createCaasTransaction).toHaveBeenCalledWith('trx-1', 5)
    expect(bdapps.caasDirectDebit).toHaveBeenCalledWith(MOCK_AUTH_USER.phone, 'trx-1', 5)
    expect(services.upsertProSubscription).toHaveBeenCalledWith(
      MOCK_AUTH_USER.id,
      MOCK_AUTH_USER.phone,
      5,
    )
    expect(services.updateCaasTransaction).toHaveBeenCalledWith('caas-1', {
      status: 'SUCCESS',
      subscriptionId: 'sub-1',
      internalTrxId: 'internal-1',
      referenceId: 'ref-1',
    })
    expect(services.markUserPro).toHaveBeenCalledWith(MOCK_AUTH_USER.id)
  })

  it('registers an unregistered subscriber before charging', async () => {
    vi.mocked(bdapps.subscriptionGetStatus)
      .mockResolvedValueOnce({
        statusCode: 'S1000',
        statusDetail: 'not registered',
        subscriptionStatus: 'UNREGISTERED',
        subscriberId: 'tel:+8801700000000',
      } as never)
      .mockResolvedValueOnce({
        statusCode: 'S1000',
        statusDetail: 'Request was successfully processed',
        subscriptionStatus: 'REGISTERED',
        subscriberId: 'tel:+8801700000000',
      } as never)
    vi.mocked(bdapps.subscriptionSend).mockResolvedValue({
      statusCode: 'S1000',
      statusDetail: 'not registered',
      subscriptionStatus: 'UNREGISTERED',
      subscriberId: 'tel:+8801700000000',
    } as never)
    vi.mocked(bdapps.caasDirectDebit).mockResolvedValue({
      statusCode: 'S1000',
      externalTrxId: 'trx-1',
      internalTrxId: 'internal-1',
      referenceId: 'ref-1',
      timeStamp: '20260531010101',
    } as never)
    vi.mocked(services.createCaasTransaction).mockResolvedValue({
      id: 'caas-1',
    } as never)
    vi.mocked(services.upsertProSubscription).mockResolvedValue({
      id: 'sub-1',
    } as never)
    vi.mocked(services.updateCaasTransaction).mockResolvedValue({
      id: 'caas-1',
    } as never)
    vi.mocked(services.markUserPro).mockResolvedValue({} as never)

    const response = await POST(request(), { user: MOCK_AUTH_USER } as never)

    expect(response.status).toBe(201)
    expect(bdapps.subscriptionGetStatus).toHaveBeenNthCalledWith(1, MOCK_AUTH_USER.phone)
    expect(bdapps.subscriptionSend).toHaveBeenCalledWith(MOCK_AUTH_USER.phone, '1')
    expect(bdapps.subscriptionGetStatus).toHaveBeenNthCalledWith(2, MOCK_AUTH_USER.phone)
    expect(services.createCaasTransaction).toHaveBeenCalledWith('trx-1', 5)
    expect(bdapps.caasDirectDebit).toHaveBeenCalledWith(MOCK_AUTH_USER.phone, 'trx-1', 5)
  })

  it('marks the CAAS transaction failed when the debit call errors', async () => {
    vi.mocked(bdapps.subscriptionGetStatus).mockResolvedValue({
      statusCode: 'S1000',
      statusDetail: 'Request was successfully processed',
      subscriptionStatus: 'REGISTERED',
      subscriberId: 'tel:+8801700000000',
    } as never)
    vi.mocked(bdapps.caasDirectDebit).mockRejectedValue(
      new ApiError(502, 'BDApps HTTP error', 'BDAPPS_HTTP_ERROR'),
    )
    vi.mocked(services.createCaasTransaction).mockResolvedValue({
      id: 'caas-1',
    } as never)
    vi.mocked(services.updateCaasTransaction).mockResolvedValue({
      id: 'caas-1',
    } as never)

    const response = await POST(request(), { user: MOCK_AUTH_USER } as never)

    expect(response.status).toBe(502)
    expect(services.createCaasTransaction).toHaveBeenCalledWith('trx-1', 5)
    expect(services.updateCaasTransaction).toHaveBeenCalledWith('caas-1', {
      status: 'FAILED',
    })
    expect(services.upsertProSubscription).not.toHaveBeenCalled()
    expect(services.markUserPro).not.toHaveBeenCalled()
  })
})

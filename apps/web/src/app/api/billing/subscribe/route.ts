import { withAuth } from '@vesta/shared/server/middleware'
import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import {
  createCaasTransaction,
  updateCaasTransaction,
  upsertProSubscription,
  markUserPro,
} from '@vesta/shared/server/services'
import { caasDirectDebit } from '@vesta/shared/server/adapters/bdapps'
import type { AuthUser } from '@vesta/shared/server/auth'

const SUBSCRIPTION_AMOUNT_BDT = 5

export const POST = withAuth(async (request, { user }: { user: AuthUser }) => {
  try {
    if (!user.phone) {
      throw new ApiError(
        400,
        'A phone number is required for CAAS billing. Please add your phone number.',
        'PHONE_REQUIRED',
      )
    }

    const externalTrxId = crypto.randomUUID()

    const pendingTransaction = await createCaasTransaction(externalTrxId, SUBSCRIPTION_AMOUNT_BDT)

    let debitResult: Awaited<ReturnType<typeof caasDirectDebit>>
    try {
      debitResult = await caasDirectDebit(user.phone, externalTrxId, SUBSCRIPTION_AMOUNT_BDT)
    } catch (chargeError) {
      await updateCaasTransaction(pendingTransaction.id, { status: 'FAILED' })
      throw chargeError
    }

    try {
      const subscription = await upsertProSubscription(
        user.id,
        user.phone,
        SUBSCRIPTION_AMOUNT_BDT,
      )

      const transaction = await updateCaasTransaction(pendingTransaction.id, {
        status: 'SUCCESS',
        subscriptionId: subscription.id,
        internalTrxId: debitResult.internalTrxId ?? null,
        referenceId: debitResult.referenceId ?? null,
      })

      await markUserPro(user.id)

      return Response.json({ subscription, transaction }, { status: 201 })
    } catch (dbError) {
      await updateCaasTransaction(pendingTransaction.id, {
        status: 'SUCCESS',
        internalTrxId: debitResult.internalTrxId ?? null,
        referenceId: debitResult.referenceId ?? null,
      }).catch(() => {})
      throw dbError
    }
  } catch (error) {
    return handleApiError(error)
  }
})

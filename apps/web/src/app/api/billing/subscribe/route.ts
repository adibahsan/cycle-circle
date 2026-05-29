import { withAuth } from '@vesta/shared/server/middleware'
import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { prisma } from '@vesta/shared'
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

    // Create a PENDING transaction record BEFORE charging to avoid charge-without-record
    const pendingTransaction = await prisma.caasTransaction.create({
      data: {
        externalTrxId,
        amount: SUBSCRIPTION_AMOUNT_BDT,
        status: 'PENDING',
      },
    })

    let debitResult: Awaited<ReturnType<typeof caasDirectDebit>>
    try {
      debitResult = await caasDirectDebit(user.phone, externalTrxId, SUBSCRIPTION_AMOUNT_BDT)
    } catch (chargeError) {
      await prisma.caasTransaction.update({
        where: { id: pendingTransaction.id },
        data: { status: 'FAILED' },
      })
      throw chargeError
    }

    // Charge succeeded — update subscription and transaction records
    try {
      const existing = await prisma.subscription.findFirst({ where: { userId: user.id } })

      const subscription = existing
        ? await prisma.subscription.update({
            where: { id: existing.id },
            data: {
              status: 'PRO',
              bdappsSubscriberId: user.phone,
              amount: SUBSCRIPTION_AMOUNT_BDT,
              consecutiveFailures: 0,
              gracePeriodEndsAt: null,
            },
          })
        : await prisma.subscription.create({
            data: {
              userId: user.id,
              status: 'PRO',
              bdappsSubscriberId: user.phone,
              amount: SUBSCRIPTION_AMOUNT_BDT,
            },
          })

      const transaction = await prisma.caasTransaction.update({
        where: { id: pendingTransaction.id },
        data: {
          subscriptionId: subscription.id,
          internalTrxId: debitResult.internalTrxId ?? null,
          referenceId: debitResult.referenceId ?? null,
          status: 'SUCCESS',
        },
      })

      await prisma.user.update({
        where: { id: user.id },
        data: { subscriptionStatus: 'PRO' },
      })

      return Response.json({ subscription, transaction }, { status: 201 })
    } catch (dbError) {
      // Charge went through but DB update failed — mark transaction SUCCESS so the charge is not lost
      await prisma.caasTransaction.update({
        where: { id: pendingTransaction.id },
        data: {
          internalTrxId: debitResult.internalTrxId ?? null,
          referenceId: debitResult.referenceId ?? null,
          status: 'SUCCESS',
        },
      }).catch(() => {
        // best-effort; original error takes priority
      })
      throw dbError
    }
  } catch (error) {
    return handleApiError(error)
  }
})

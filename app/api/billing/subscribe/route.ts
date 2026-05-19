import { z } from 'zod'
import { withAuth } from '@/lib/server/middleware'
import { handleApiError, ApiError } from '@/lib/server/api-error'
import { parseBody } from '@/lib/server/validation'
import { prisma } from '@/lib/server/db'
import { caasDirectDebit } from '@/lib/server/adapters/bdapps'
import type { AuthUser } from '@/lib/server/auth'

const bodySchema = z.object({
  amount: z.number().int().positive('Amount must be a positive integer'),
})

export const POST = withAuth(async (request, { user }: { user: AuthUser }) => {
  try {
    const body = await parseBody(request, bodySchema)

    if (!user.phone) {
      throw new ApiError(
        400,
        'A phone number is required for CAAS billing. Please add your phone number.',
        'PHONE_REQUIRED',
      )
    }

    const externalTrxId = crypto.randomUUID()

    const debitResult = await caasDirectDebit(user.phone, externalTrxId, body.amount)

    const existing = await prisma.subscription.findFirst({ where: { userId: user.id } })

    const subscription = existing
      ? await prisma.subscription.update({
          where: { id: existing.id },
          data: {
            status: 'PRO',
            bdappsSubscriberId: user.phone,
            amount: body.amount,
            consecutiveFailures: 0,
            gracePeriodEndsAt: null,
          },
        })
      : await prisma.subscription.create({
          data: {
            userId: user.id,
            status: 'PRO',
            bdappsSubscriberId: user.phone,
            amount: body.amount,
          },
        })

    const transaction = await prisma.caasTransaction.create({
      data: {
        subscriptionId: subscription.id,
        externalTrxId,
        internalTrxId: debitResult.internalTrxId ?? null,
        referenceId: debitResult.referenceId ?? null,
        amount: body.amount,
        status: 'SUCCESS',
      },
    })

    await prisma.user.update({
      where: { id: user.id },
      data: { subscriptionStatus: 'PRO' },
    })

    return Response.json({ subscription, transaction }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
})

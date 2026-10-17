import { withAuth } from '@vesta/shared/server/middleware'
import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { applyBdappsSubscription, getBdappsSubscriberId, hasAdminOverride } from '@vesta/shared/server/services'
import { setSubscription } from '@vesta/shared/server/adapters/bdapps'
import type { AuthUser } from '@vesta/shared/server/auth'
import { revalidateTag } from 'next/cache'
import { cacheTags } from '@/lib/cache-tags'
import { logger } from '@vesta/shared/server/log'
import { logCustomerRefusal } from '@/app/api/auth/log-failure'

export const POST = withAuth(async (_request, { user }: { user: AuthUser }) => {
  let subscriberId: string | undefined
  try {
    if (!user.phone) {
      throw new ApiError(400, 'A phone number is required to unsubscribe.', 'NO_PHONE')
    }

    if (await hasAdminOverride(user.id)) {
      throw new ApiError(
        409,
        'Your plan was set by an admin and cannot be cancelled here.',
        'ADMIN_OVERRIDE',
      )
    }

    // The masked id stored at OTP verify; legacy rows only have the phone.
    subscriberId = (await getBdappsSubscriberId(user.id)) ?? user.phone
    await setSubscription(subscriberId, 'unsubscribe')
    const status = await applyBdappsSubscription(user.id, subscriberId, false, 'unsubscribe')
    revalidateTag(cacheTags.user(user.id), { expire: 0 })

    logger.customer('billing.unsubscribe', { phone: user.phone, subscriberId, ok: true, status })
    return Response.json({ status })
  } catch (error) {
    logCustomerRefusal('billing.unsubscribe', error, { phone: user.phone, subscriberId })
    return handleApiError(error)
  }
}, { allowExpiredTrial: true })

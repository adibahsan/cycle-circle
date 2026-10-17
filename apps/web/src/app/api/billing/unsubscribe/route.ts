import { withAuth } from '@vesta/shared/server/middleware'
import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { applyBdappsSubscription } from '@vesta/shared/server/services'
import { setSubscription } from '@vesta/shared/server/adapters/bdapps'
import type { AuthUser } from '@vesta/shared/server/auth'
import { revalidateTag } from 'next/cache'
import { cacheTags } from '@/lib/cache-tags'

export const POST = withAuth(async (_request, { user }: { user: AuthUser }) => {
  try {
    if (!user.phone) {
      throw new ApiError(400, 'A phone number is required to unsubscribe.', 'NO_PHONE')
    }

    await setSubscription(user.phone, 'unsubscribe')
    const status = await applyBdappsSubscription(user.id, user.phone, false)
    revalidateTag(cacheTags.user(user.id), { expire: 0 })

    return Response.json({ status })
  } catch (error) {
    return handleApiError(error)
  }
}, { allowExpiredTrial: true })

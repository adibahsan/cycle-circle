import { revalidateTag } from 'next/cache'
import { withCronAuth } from '@vesta/shared/server/middleware'
import { handleApiError } from '@vesta/shared/server/api-error'
import { isAllowedRevalidationTag } from '@/lib/cache-tags'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withCronAuth(async (request) => {
  try {
    const body = await request.json().catch(() => ({})) as { tags?: unknown }
    const tags = Array.isArray(body.tags) ? body.tags : []
    const revalidated: string[] = []

    for (const tag of tags) {
      if (typeof tag === 'string' && isAllowedRevalidationTag(tag)) {
        revalidateTag(tag, { expire: 0 })
        revalidated.push(tag)
      }
    }

    return Response.json({ revalidated })
  } catch (error) {
    return handleApiError(error)
  }
})

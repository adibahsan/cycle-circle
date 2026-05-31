'use server'

import { requireAdminAuth } from '@vesta/shared/server/auth'
import { revalidateTag } from 'next/cache'

export async function revalidateAdminTags(tags: string[]) {
  await requireAdminAuth()
  for (const tag of tags) {
    revalidateTag(tag, { expire: 0 })
  }
}

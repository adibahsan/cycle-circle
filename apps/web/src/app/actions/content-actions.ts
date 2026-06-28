'use server'

import { requireAuth } from '@vesta/shared/server/auth'
import { getPublishedArticleById } from '@vesta/shared/server/services'

/**
 * Fetch the body of a single published article after verifying the user is
 * authenticated. Called by the client when the reader is opened so the full
 * article body is never included in the initial RSC payload.
 */
export async function getArticleBody(id: string) {
  await requireAuth()
  return getPublishedArticleById(id)
}

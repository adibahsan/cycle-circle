'use server'

import { requireAdminAuth } from '@vesta/shared/server/auth'
import { renderEmailLogPreview } from '@vesta/shared/server/email-log-preview'

export async function getEmailLogPreviewHtml(id: string) {
  await requireAdminAuth()
  return renderEmailLogPreview(id)
}

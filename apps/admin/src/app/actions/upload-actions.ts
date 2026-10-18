'use server'

import { requireAdminAuth } from '@vesta/shared/server/auth'
import { saveArticleImage } from '@vesta/shared/server/services'

/** Upload one article image (FormData field `file`). Returns its `/uploads/...` url. */
export async function uploadArticleImage(
  formData: FormData,
): Promise<{ url: string } | { error: string }> {
  await requireAdminAuth()
  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'No file provided.' }
  try {
    const { url } = await saveArticleImage(Buffer.from(await file.arrayBuffer()))
    return { url }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Upload failed.' }
  }
}

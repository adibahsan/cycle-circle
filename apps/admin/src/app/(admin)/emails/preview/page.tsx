export const dynamic = 'force-dynamic'

import { requireAdminUser } from '@/app/queries/auth-queries'
import { EmailPreviewClient } from './EmailPreviewClient'

export default async function EmailPreviewPage() {
  await requireAdminUser()
  return <EmailPreviewClient />
}

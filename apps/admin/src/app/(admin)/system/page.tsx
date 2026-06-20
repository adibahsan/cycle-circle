import { requireAdminUser } from '@/app/queries/auth-queries'
import { SystemClient } from './SystemClient'

export default async function SystemPage() {
  await requireAdminUser()
  return <SystemClient />
}

import { requireAdminUser } from '@/app/queries/auth-queries'
import { getCronSettings } from '@vesta/shared/server/services'
import { SystemClient } from './SystemClient'

export default async function SystemPage() {
  await requireAdminUser()
  const cronSettings = await getCronSettings()
  return <SystemClient initialSettings={cronSettings} />
}

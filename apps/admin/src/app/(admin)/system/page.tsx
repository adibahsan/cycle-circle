import { requireAdminUser } from '@/app/queries/auth-queries'
import { getCronSettings, getSmsDeliveryReports, getSmsSendTime } from '@vesta/shared/server/services'
import { SystemClient } from './SystemClient'

export default async function SystemPage() {
  await requireAdminUser()
  const cronSettings = await getCronSettings()
  const smsSendTime = await getSmsSendTime()
  const smsDeliveryReports = await getSmsDeliveryReports()
  return (
    <SystemClient
      initialSettings={cronSettings}
      initialSmsSendTime={smsSendTime}
      initialSmsDeliveryReports={smsDeliveryReports}
    />
  )
}

import { requireAdminUser } from '@/app/queries/auth-queries'
import { getCronSettings, getSmsDeliveryReports, getSmsSendTime, listProPriceHistory } from '@vesta/shared/server/services'
import { bangladeshToday } from '@vesta/shared/utils/dhaka-date'
import { SystemClient } from './SystemClient'
import { RunHistory } from './RunHistory'

export default async function SystemPage() {
  await requireAdminUser()
  const cronSettings = await getCronSettings()
  const smsSendTime = await getSmsSendTime()
  const smsDeliveryReports = await getSmsDeliveryReports()
  const proPrices = await listProPriceHistory()
  return (
    <SystemClient
      initialSettings={cronSettings}
      initialSmsSendTime={smsSendTime}
      initialSmsDeliveryReports={smsDeliveryReports}
      runHistory={<RunHistory />}
      initialProPrices={proPrices}
      today={bangladeshToday()}
    />
  )
}

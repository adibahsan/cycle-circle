import { requireAdminUser } from '@/app/queries/auth-queries'
import { getCronSettings, getReportRecipients, getSmsDeliveryReports, getSmsSendTime } from '@vesta/shared/server/services'
import { bangladeshToday } from '@vesta/shared/utils/dhaka-date'
import { getProPriceHistory } from '@/app/queries/system-queries'
import { SystemClient } from './SystemClient'
import { RunHistory } from './RunHistory'

export default async function SystemPage() {
  await requireAdminUser()
  const cronSettings = await getCronSettings()
  const smsSendTime = await getSmsSendTime()
  const smsDeliveryReports = await getSmsDeliveryReports()
  const reportRecipients = await getReportRecipients()
  const proPrices = await getProPriceHistory()
  return (
    <SystemClient
      initialSettings={cronSettings}
      initialSmsSendTime={smsSendTime}
      initialSmsDeliveryReports={smsDeliveryReports}
      initialReportRecipients={reportRecipients}
      runHistory={<RunHistory />}
      initialProPrices={proPrices}
      today={bangladeshToday()}
    />
  )
}

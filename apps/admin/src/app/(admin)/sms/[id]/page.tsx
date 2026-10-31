import { notFound } from 'next/navigation'
import { requireAdminUser } from '@/app/queries/auth-queries'
import { getSmsCampaign } from '@/app/queries/sms-queries'
import { CampaignDetailClient } from './CampaignDetailClient'

export default async function SmsCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminUser()
  const { id } = await params
  const campaign = await getSmsCampaign(id)
  if (!campaign) notFound()
  return <CampaignDetailClient campaign={campaign} />
}

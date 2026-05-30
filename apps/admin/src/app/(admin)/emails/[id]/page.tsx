import { notFound } from 'next/navigation'
import { getEmailLogDetail } from '@/app/queries/email-queries'
import { EmailDetailClient } from './EmailDetailClient'

export default async function EmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const log = await getEmailLogDetail(id)
  if (!log) notFound()
  return <EmailDetailClient log={log} />
}

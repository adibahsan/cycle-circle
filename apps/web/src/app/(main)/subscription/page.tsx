import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/app/queries/auth-queries'
import { SubscriptionClient } from './SubscriptionClient'

export default async function SubscriptionPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return <SubscriptionClient user={user} />
}

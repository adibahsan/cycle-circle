import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/app/queries/auth-queries'
import { ContentClient } from './ContentClient'

export default async function ContentPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return <ContentClient />
}

import type { Metadata } from 'next'
import { GuideClient } from './GuideClient'

export const metadata: Metadata = {
  title: 'User guide | Cycle Circle',
  description: 'How to get started with Cycle Circle: log in, set up your profile, log your cycle, and manage your subscription.',
}

export default function GuidePage() {
  return <GuideClient />
}

import { notFound } from 'next/navigation';
import BackendChecklistClient from './BackendChecklistClient'

export const metadata = {
  title: 'Vesta Backend Checklist',
}

export const dynamic = 'force-dynamic'

export default function BackendChecklistPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return <BackendChecklistClient />
}

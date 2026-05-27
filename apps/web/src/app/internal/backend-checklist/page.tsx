import BackendChecklistClient from './BackendChecklistClient'

export const metadata = {
  title: 'Vesta Backend Checklist',
}

export const dynamic = 'force-dynamic'

export default function BackendChecklistPage() {
  return <BackendChecklistClient />
}

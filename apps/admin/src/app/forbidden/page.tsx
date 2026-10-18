import type { Metadata } from 'next'
import VestaLogo from '@/components/ui/VestaLogo'
import SwitchAccountButton from './SwitchAccountButton'

export const metadata: Metadata = { title: 'Not an admin' }

// Served with HTTP 403 by the admin proxy (rewrite) when a non-admin token hits an admin route.
export default function ForbiddenPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)] px-4">
      <div className="glass rounded-2xl p-8 shadow-soft w-full max-w-md flex flex-col items-center gap-4 text-center">
        <VestaLogo size={48} />
        <h1 className="text-2xl font-extrabold text-[var(--color-text-primary)]">Not an admin</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          You&apos;re signed in with an account that doesn&apos;t have admin access. Log out and sign in with the admin account to continue.
        </p>
        <SwitchAccountButton />
      </div>
    </main>
  )
}

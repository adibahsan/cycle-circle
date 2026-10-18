'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SwitchAccountButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function switchAccount() {
    setBusy(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.push('/login')
      router.refresh()
    }
  }

  return (
    <button
      type="button"
      onClick={switchAccount}
      disabled={busy}
      className="w-full py-3 rounded-xl bg-[var(--color-action)] text-[var(--color-on-action)] text-sm font-semibold shadow-soft hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-50"
    >
      Log out and switch account
    </button>
  )
}

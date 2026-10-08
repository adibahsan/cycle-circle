'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="text-center space-y-4 px-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Something went wrong</h2>
        <p className="text-sm text-[var(--color-text-muted)]">An unexpected error occurred. Please try again or log in.</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 rounded-xl bg-[var(--color-action)] text-[var(--color-on-action)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Go to Login
          </button>
        </div>
      </div>
    </div>
  )
}

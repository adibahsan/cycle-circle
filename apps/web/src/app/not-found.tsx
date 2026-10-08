import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Page not found</h2>
        <p className="text-sm text-[var(--color-text-muted)]">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link
          href="/dashboard"
          className="inline-block px-4 py-2 rounded-xl bg-[var(--color-action)] text-[var(--color-on-action)] text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}

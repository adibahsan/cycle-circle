export default function AdminLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div role="status" aria-label="Loading" className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--color-text-muted)] motion-safe:animate-pulse">Loading…</p>
      </div>
    </div>
  )
}

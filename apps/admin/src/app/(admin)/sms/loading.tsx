import { Shimmer } from '@/components/ui/Shimmer'

export default function SmsLoading() {
  return (
    <div className="space-y-6">
      {/* Header shimmer */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Shimmer className="h-8 w-48" />
          <Shimmer className="h-4 w-32" />
        </div>
        <Shimmer className="h-9 w-36 rounded-xl" />
      </div>

      {/* Filter bar shimmer */}
      <div className="flex gap-3">
        <Shimmer className="h-10 flex-1" />
        <Shimmer className="h-10 w-40" />
      </div>

      {/* Table shimmer */}
      <div className="rounded-2xl border border-[var(--color-border)] glass overflow-hidden">
        {/* Header */}
        <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-5 py-3 flex gap-4">
          {['w-36', 'w-20', 'w-28', 'w-24', 'w-16', 'w-20', 'w-16', 'w-24'].map((w, i) => (
            <Shimmer key={i} className={`h-3 ${w}`} />
          ))}
        </div>

        {/* Rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="border-b border-[var(--color-border)] last:border-0 px-5 py-4 flex gap-4 items-center"
          >
            <Shimmer className="h-4 w-64" />
            <Shimmer className="h-6 w-20 rounded-full" />
            <Shimmer className="h-4 w-32" />
            <Shimmer className="h-4 w-28" />
            <Shimmer className="h-4 w-12" />
            <Shimmer className="h-4 w-12" />
            <Shimmer className="h-4 w-12" />
            <Shimmer className="h-4 w-24" />
          </div>
        ))}
      </div>

      {/* Pagination shimmer */}
      <div className="flex items-center justify-between">
        <Shimmer className="h-8 w-40" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Shimmer key={i} className="h-8 w-8 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}

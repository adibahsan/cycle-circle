import { Shimmer } from '@/components/ui/Shimmer'

export default function SubscriptionsLoading() {
  return (
    <div className="space-y-6">
      {/* Header shimmer */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Shimmer className="h-8 w-44" />
          <Shimmer className="h-4 w-40" />
        </div>
        <Shimmer className="hidden sm:block h-10 w-36 rounded-xl" />
      </div>

      {/* Filter bar shimmer */}
      <div className="flex gap-3">
        <Shimmer className="h-10 flex-1" />
        <Shimmer className="h-10 w-40" />
      </div>

      {/* Table shimmer */}
      <div className="rounded-2xl border border-[var(--color-border)] glass overflow-hidden">
        {/* Header row */}
        <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-5 py-3 flex gap-5 items-center">
          {['w-32', 'w-16', 'w-20', 'w-16', 'w-28', 'w-24', 'w-28', 'w-20'].map((w, i) => (
            <Shimmer key={i} className={`h-3 ${w}`} />
          ))}
        </div>

        {/* Data rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="border-b border-[var(--color-border)] last:border-0 px-5 py-4 flex gap-5 items-center"
          >
            {/* User cell — stacked */}
            <div className="space-y-1.5 w-40 shrink-0">
              <Shimmer className="h-4 w-32" />
              <Shimmer className="h-3 w-36" />
              <Shimmer className="h-3 w-24" />
            </div>
            {/* Status badge */}
            <Shimmer className="h-6 w-16 rounded-full shrink-0" />
            {/* Amount */}
            <Shimmer className="h-4 w-16 shrink-0" />
            {/* Failures */}
            <Shimmer className="h-4 w-8 shrink-0" />
            {/* Grace period */}
            <Shimmer className="h-4 w-24 shrink-0" />
            {/* Admin override */}
            <Shimmer className="h-6 w-20 rounded-full shrink-0" />
            {/* Last transaction */}
            <div className="space-y-1 shrink-0">
              <Shimmer className="h-4 w-24" />
              <Shimmer className="h-3 w-16" />
            </div>
            {/* Actions */}
            <Shimmer className="h-8 w-20 rounded-xl shrink-0 ml-auto" />
          </div>
        ))}
      </div>

      {/* Pagination shimmer */}
      <div className="flex items-center justify-between py-3">
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

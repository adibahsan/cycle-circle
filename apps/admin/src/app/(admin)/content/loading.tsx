import { Shimmer } from '@/components/ui/Shimmer'

export default function ContentLoading() {
  return (
    <div className="space-y-6">
      {/* Header shimmer */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Shimmer className="h-7 w-32" />
          <Shimmer className="h-4 w-24" />
        </div>
        <Shimmer className="h-9 w-32 rounded-xl" />
      </div>

      {/* Filter bar shimmer */}
      <div className="flex flex-wrap items-center gap-3">
        <Shimmer className="h-10 flex-1 min-w-[200px] rounded-xl" />
        <Shimmer className="h-10 w-40 rounded-xl" />
        <Shimmer className="h-10 w-44 rounded-xl" />
      </div>

      {/* Table shimmer */}
      <div className="rounded-2xl border border-[var(--color-border)] glass overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-7 gap-4 px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          {['Title', 'Status', 'Category', 'Phases', 'Author', 'Published', ''].map((h) => (
            <Shimmer key={h} className="h-3.5 rounded" />
          ))}
        </div>

        {/* Body rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-7 gap-4 px-5 py-4 border-b border-[var(--color-border)] last:border-0"
          >
            <div className="space-y-1.5">
              <Shimmer className="h-4 w-full" />
              <Shimmer className="h-3 w-3/4" />
            </div>
            <Shimmer className="h-5 w-16 rounded-full" />
            <Shimmer className="h-4 w-20" />
            <div className="flex gap-1">
              <Shimmer className="h-5 w-14 rounded-full" />
              <Shimmer className="h-5 w-14 rounded-full" />
            </div>
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-4 w-20" />
            <Shimmer className="h-6 w-16 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Pagination shimmer */}
      <div className="flex items-center justify-between py-3">
        <Shimmer className="h-8 w-36 rounded-lg" />
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Shimmer key={i} className="h-8 w-8 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}

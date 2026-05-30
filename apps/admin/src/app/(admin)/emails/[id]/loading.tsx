import { Shimmer } from '@/components/ui/Shimmer'

export default function EmailDetailLoading() {
  return (
    <div className="space-y-6 page-enter">
      <Shimmer className="h-4 w-36" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Shimmer className="h-8 w-40" />
          <Shimmer className="h-4 w-56" />
        </div>
        <Shimmer className="h-9 w-24 rounded-xl" />
      </div>
      <div className="glass rounded-2xl border border-[var(--color-border)] p-6 shadow-soft space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Shimmer key={i} className="h-4 w-full max-w-md" />
        ))}
      </div>
      <Shimmer className="h-[640px] w-full rounded-2xl" />
    </div>
  )
}

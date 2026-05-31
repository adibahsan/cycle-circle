import { Shimmer } from '@/components/ui/Shimmer'

export default function FeedbackDetailLoading() {
  return (
    <div className="space-y-6 page-enter">
      <Shimmer className="h-4 w-32" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Shimmer className="h-8 w-48" />
          <Shimmer className="h-4 w-64" />
        </div>
        <Shimmer className="h-9 w-24 rounded-xl" />
      </div>
      <div className="glass rounded-2xl border border-[var(--color-border)] p-6 shadow-soft space-y-4">
        <div className="flex gap-2">
          <Shimmer className="h-6 w-20 rounded-full" />
          <Shimmer className="h-6 w-28" />
        </div>
        <Shimmer className="h-4 w-40" />
        <Shimmer className="h-24 w-full" />
      </div>
    </div>
  )
}

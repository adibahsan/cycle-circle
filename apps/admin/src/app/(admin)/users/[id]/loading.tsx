import { Shimmer } from '@/components/ui/Shimmer'

export default function UserDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Back link shimmer */}
      <Shimmer className="h-4 w-24" />

      {/* User header card shimmer */}
      <div className="glass rounded-2xl border border-[var(--color-border)] p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Shimmer className="h-14 w-14 rounded-full" />
            <div className="space-y-2">
              <Shimmer className="h-6 w-40" />
              <Shimmer className="h-4 w-56" />
              <Shimmer className="h-4 w-32" />
            </div>
          </div>
          <div className="flex gap-2">
            <Shimmer className="h-9 w-24 rounded-xl" />
            <Shimmer className="h-9 w-28 rounded-xl" />
            <Shimmer className="h-9 w-20 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Tabs shimmer */}
      <div className="flex gap-2">
        <Shimmer className="h-9 w-24 rounded-xl" />
        <Shimmer className="h-9 w-28 rounded-xl" />
        <Shimmer className="h-9 w-20 rounded-xl" />
      </div>

      {/* Content shimmer */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="glass rounded-2xl border border-[var(--color-border)] p-5 shadow-soft space-y-3"
          >
            <Shimmer className="h-5 w-48" />
            <div className="grid grid-cols-2 gap-3">
              <Shimmer className="h-4 w-full" />
              <Shimmer className="h-4 w-3/4" />
              <Shimmer className="h-4 w-5/6" />
              <Shimmer className="h-4 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

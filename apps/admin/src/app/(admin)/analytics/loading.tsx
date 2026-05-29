import { Shimmer } from '@/components/ui/Shimmer'

// Heights expressed as Tailwind classes to avoid needing inline style on Shimmer
const BAR_HEIGHTS = ['h-[55%]', 'h-[75%]', 'h-[90%]', 'h-[65%]', 'h-[80%]', 'h-[45%]', 'h-[70%]', 'h-[60%]', 'h-[85%]', 'h-[50%]']

function ChartCardSkeleton() {
  return (
    <div className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-soft p-7">
      {/* Card header */}
      <div className="mb-5 space-y-2">
        <Shimmer className="h-5 w-48" />
        <Shimmer className="h-3 w-64" />
      </div>

      {/* Chart area */}
      <div className="relative overflow-hidden rounded-xl h-60">
        {/* Fake bar columns */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-around gap-2 px-4 h-full">
          {BAR_HEIGHTS.map((heightClass, i) => (
            <div
              key={i}
              className={`flex-1 rounded-t-md animate-shimmer ${heightClass}`}
              style={{
                background: 'linear-gradient(to right, transparent, var(--color-border), transparent)',
                backgroundSize: '200% 100%',
                animationDelay: `${i * 80}ms`,
              }}
            />
          ))}
        </div>
        {/* X-axis line */}
        <div className="absolute bottom-0 inset-x-0 h-px bg-[var(--color-border)]" />
      </div>

      {/* Optional bottom badges */}
      <div className="mt-4 flex gap-2">
        <Shimmer className="h-6 w-14 rounded-full" />
        <Shimmer className="h-6 w-18 rounded-full" />
        <Shimmer className="h-6 w-12 rounded-full" />
      </div>
    </div>
  )
}

export default function AnalyticsLoading() {
  return (
    <div className="space-y-8">
      {/* Page header shimmer */}
      <div className="space-y-2">
        <Shimmer className="h-8 w-36" />
        <Shimmer className="h-4 w-72" />
      </div>

      {/* 2-column chart grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
    </div>
  )
}

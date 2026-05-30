import { Shimmer } from '@/components/ui/Shimmer';

export default function ContentLoading() {
  return (
    <div className="py-4 space-y-5 animate-pulse-soft">
      {/* Page Header */}
      <div>
        <Shimmer className="h-7 w-40 rounded-lg" />
        <Shimmer className="h-4 w-64 rounded-md mt-1.5" />
      </div>

      {/* Horizontal Category Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <Shimmer className="h-8 w-24 rounded-full shrink-0" />
        <Shimmer className="h-8 w-28 rounded-full shrink-0" />
        <Shimmer className="h-8 w-26 rounded-full shrink-0" />
        <Shimmer className="h-8 w-26 rounded-full shrink-0" />
        <Shimmer className="h-8 w-24 rounded-full shrink-0" />
      </div>

      {/* Article Cards Stack */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 flex justify-between items-start gap-4"
          >
            <div className="flex-1 space-y-2">
              {/* Category tag */}
              <Shimmer className="h-4 w-16 rounded-full" />
              {/* Article Title */}
              <Shimmer className="h-5 w-3/4 rounded-lg" />
              {/* Article Excerpt */}
              <div className="space-y-1.5 pt-1">
                <Shimmer className="h-3.5 w-full rounded-md" />
                <Shimmer className="h-3.5 w-5/6 rounded-md" />
              </div>
              {/* Phase badges */}
              <div className="flex gap-1.5 pt-2">
                <Shimmer className="h-4 w-12 rounded" />
                <Shimmer className="h-4 w-14 rounded" />
              </div>
            </div>
            
            {/* Chevron placeholder */}
            <Shimmer className="h-5 w-5 rounded-md mt-1.5" />
          </div>
        ))}
      </div>
    </div>
  );
}

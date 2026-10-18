import { PageContainer } from '@/components/ui/PageContainer'
import { Shimmer } from '@/components/ui/Shimmer';

export default function CalendarLoading() {
  return (
    <PageContainer width="canvas" fill>
      {/* Page Header */}
      <div>
        <Shimmer className="h-7 w-28 rounded-lg" />
      </div>

      {/* Main split layout */}
      <div className="flex flex-col gap-5 xl:flex-1 xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_26rem]">
        {/* Calendar Grid Card */}
        <div className="min-w-0 rounded-panel bg-[var(--color-bg-card)] border border-transparent dark:border-[var(--color-border)] shadow-panel px-2 py-2 sm:px-4 md:py-4 space-y-2">
          {/* Header controls (Month / Navs) */}
          <div className="flex justify-between items-center">
            <Shimmer className="h-9 w-9 rounded-xl" />
            <Shimmer className="h-6 w-36 rounded-md" />
            <Shimmer className="h-9 w-9 rounded-xl" />
          </div>

          {/* DOW header row */}
          <div className="grid grid-cols-7 gap-2 pb-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex justify-center">
                <Shimmer className="h-3 w-8 rounded-md" />
              </div>
            ))}
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7 gap-0.5 md:gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <Shimmer key={i} className="h-11 md:h-14 2xl:h-16 w-full rounded-xl" />
            ))}
          </div>

          {/* Legend divider & elements */}
          <div className="border-t border-[var(--color-border)] pt-4 flex flex-wrap gap-x-4 gap-y-2 justify-center">
            <Shimmer className="h-4 w-16 rounded-full" />
            <Shimmer className="h-4 w-16 rounded-full" />
            <Shimmer className="h-4 w-16 rounded-full" />
            <Shimmer className="h-4 w-16 rounded-full" />
          </div>
        </div>

        {/* Right Detail/Summary panels */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* Detailed Selected Day Sheet */}
          <div className="rounded-panel bg-[var(--color-bg-card)] border border-transparent dark:border-[var(--color-border)] shadow-panel p-6 space-y-4">
            <div className="flex justify-between items-center">
              <Shimmer className="h-5 w-44 rounded-lg" />
              <Shimmer className="h-6 w-6 rounded-full" />
            </div>
            {/* Status pills list */}
            <div className="flex gap-2">
              <Shimmer className="h-6 w-20 rounded-full" />
              <Shimmer className="h-6 w-24 rounded-full" />
            </div>
            {/* Symptoms list */}
            <div className="flex flex-wrap gap-2 pt-2">
              <Shimmer className="h-6 w-16 rounded-full" />
              <Shimmer className="h-6 w-20 rounded-full" />
              <Shimmer className="h-6 w-14 rounded-full" />
            </div>
          </div>

          {/* Monthly Cycle Prediction Summary Card */}
          <div className="rounded-panel bg-[var(--color-bg-card)] border border-transparent dark:border-[var(--color-border)] shadow-panel p-6 space-y-3">
            <Shimmer className="h-4.5 w-24 rounded-md" />
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Shimmer className="h-4 w-28 rounded-md" />
                <Shimmer className="h-4 w-12 rounded-md" />
              </div>
              <div className="flex justify-between items-center">
                <Shimmer className="h-4 w-32 rounded-md" />
                <Shimmer className="h-4 w-12 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

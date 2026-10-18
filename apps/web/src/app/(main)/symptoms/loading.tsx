import { PageContainer } from '@/components/ui/PageContainer'
import { Shimmer } from '@/components/ui/Shimmer';

export default function SymptomsLoading() {
  return (
    <PageContainer>
      {/* Split layout */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left Column: Title + Mini Calendar */}
        <div className="lg:w-[480px] lg:shrink-0 flex flex-col gap-3">
          {/* Header */}
          <div>
            <Shimmer className="h-7 w-40 rounded-lg" />
            <Shimmer className="h-4 w-48 rounded-md mt-1.5" />
          </div>

          {/* Mini Calendar Card */}
          <div className="rounded-panel bg-[var(--color-bg-card)] shadow-panel dark:border dark:border-[var(--color-border)] p-6 space-y-4">
            <div className="flex justify-between items-center">
              <Shimmer className="h-8 w-8 rounded-xl" />
              <Shimmer className="h-5 w-32 rounded-md" />
              <Shimmer className="h-8 w-8 rounded-xl" />
            </div>

            <div className="grid grid-cols-7 gap-2 text-center pb-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex justify-center">
                  <Shimmer className="h-3 w-6 rounded-md" />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }).map((_, i) => (
                <Shimmer key={i} className="aspect-square w-full rounded-xl" />
              ))}
            </div>
          </div>

          {/* Summary Card */}
          <div className="rounded-panel bg-[var(--color-bg-card)] shadow-panel dark:border dark:border-[var(--color-border)] p-4">
            <div className="flex flex-col items-center gap-2">
              <Shimmer className="h-4 w-32 rounded-md" />
              <div className="flex gap-1">
                <Shimmer className="h-5 w-8 rounded-full" />
                <Shimmer className="h-5 w-8 rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Tab selector + Symptom Chips grid */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Category Tabs */}
          <div className="rounded-full p-1 bg-[var(--color-bg-secondary)] flex gap-1">
            <Shimmer className="h-10 flex-1 rounded-full" />
            <Shimmer className="h-10 flex-1 rounded-full" />
            <Shimmer className="h-10 flex-1 rounded-full" />
            <Shimmer className="h-10 flex-1 rounded-full" />
          </div>

          {/* Symptom chips grid */}
          <div className="rounded-panel bg-tint-pink p-3 md:p-4 grid grid-cols-3 xl:grid-cols-4 gap-2">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-[var(--color-bg-card)]">
                <Shimmer className="h-10 w-10 rounded-full" />
                <Shimmer className="h-3 w-14 rounded-md" />
              </div>
            ))}
          </div>

          {/* Save button placeholder */}
          <Shimmer className="h-12 w-full rounded-full mt-2" />
        </div>
      </div>
    </PageContainer>
  );
}

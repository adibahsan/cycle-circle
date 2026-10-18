import { PageContainer } from '@/components/ui/PageContainer'
import { Shimmer } from '@/components/ui/Shimmer';

export default function SymptomsLoading() {
  return (
    <PageContainer width="canvas">
      {/* Split layout */}
      <div className="flex flex-col xl:flex-row xl:items-start gap-3 md:gap-5">
        {/* Left Column: Title + Mini Calendar */}
        <div className="xl:w-[400px] 2xl:w-[440px] xl:shrink-0 flex flex-col gap-3">
          {/* Header */}
          <div>
            <Shimmer className="h-7 w-40 rounded-lg" />
            <Shimmer className="h-4 w-48 rounded-md mt-1.5" />
          </div>

          {/* Mini Calendar Card */}
          <div className="rounded-panel bg-[var(--color-bg-card)] shadow-panel dark:border dark:border-[var(--color-border)] px-2 py-2 sm:px-4 md:py-4 space-y-2">
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

            <div className="grid grid-cols-7 gap-0.5 md:gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <Shimmer key={i} className="h-11 md:h-12 2xl:h-16 w-full rounded-xl" />
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
          {/* Toolbar: All good (first below xl, right on xl+) + category tabs */}
          <div className="flex flex-col gap-4 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between xl:gap-3">
            <Shimmer className="h-11 w-full rounded-full order-first xl:order-last xl:w-40" />
            <div className="rounded-full p-1 bg-[var(--color-bg-secondary)] flex gap-1 xl:w-fit">
              <Shimmer className="h-11 flex-1 rounded-full xl:w-24 xl:flex-none" />
              <Shimmer className="h-11 flex-1 rounded-full xl:w-24 xl:flex-none" />
              <Shimmer className="h-11 flex-1 rounded-full xl:w-24 xl:flex-none" />
              <Shimmer className="h-11 flex-1 rounded-full xl:w-24 xl:flex-none" />
            </div>
          </div>

          {/* Symptom chips grid */}
          <div className="rounded-panel bg-tint-pink p-2 md:p-4 grid grid-cols-3 auto-rows-fr gap-1.5 md:gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center justify-center gap-1 md:gap-2 p-1.5 min-h-[72px] md:min-h-[88px] rounded-2xl bg-[var(--color-bg-card)]">
                <Shimmer className="h-8 w-8 rounded-full" />
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

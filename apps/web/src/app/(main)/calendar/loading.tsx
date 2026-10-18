import { PageContainer } from '@/components/ui/PageContainer'
import { Shimmer } from '@/components/ui/Shimmer'

const PANEL = 'rounded-panel bg-[var(--color-bg-card)] border border-transparent shadow-panel'

/** Skeleton in the calendar's shape: title, month grid card (roomy day tiles), then day detail, this-cycle and recent-periods cards. */
export default function CalendarLoading() {
  return (
    <PageContainer width="canvas">
      <Shimmer className="h-8 w-32 rounded-lg md:h-9" />

      <div className="flex flex-col gap-3 md:gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_26rem]">
        {/* Month grid card */}
        <div className="min-w-0 xl:self-start">
          <div className={`${PANEL} px-2 py-2 sm:px-4 md:py-4`}>
            <div className="mb-1 flex items-center justify-between md:mb-2">
              <Shimmer className="h-11 w-11 rounded-xl" />
              <Shimmer className="h-5 w-36 rounded-md" />
              <Shimmer className="h-11 w-11 rounded-xl" />
            </div>
            <div className="mb-1 grid grid-cols-7">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex justify-center">
                  <Shimmer className="h-3 w-6 rounded-md" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5 md:gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <Shimmer key={i} className="h-11 w-full rounded-xl md:h-14 xl:h-16 2xl:h-24" />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-[var(--color-border)] pt-2 md:mt-3 md:pt-3">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <Shimmer key={i} className="h-4 w-16 rounded-full md:w-24" />
              ))}
            </div>
          </div>
        </div>

        {/* Day detail (desktop selects today), this cycle, recent periods */}
        <div className="flex min-w-0 flex-col gap-3 md:gap-4 xl:self-start">
          <div className={`${PANEL} hidden h-[150px] p-5 xl:block`}>
            <Shimmer className="h-5 w-40 rounded-lg" />
            <div className="mt-3 flex gap-2">
              <Shimmer className="h-6 w-20 rounded-full" />
              <Shimmer className="h-6 w-24 rounded-full" />
            </div>
          </div>
          <div className="h-[100px] rounded-panel bg-tint-lavender p-3 md:h-[116px] md:p-5">
            <Shimmer className="h-4 w-24 rounded-md" />
            <div className="mt-3 space-y-2">
              <Shimmer className="h-3 w-full rounded-md" />
              <Shimmer className="h-3 w-full rounded-md" />
            </div>
          </div>
          <div className={`${PANEL} h-[46px] xl:hidden`} />
          <div className="h-[178px] rounded-panel bg-tint-pink p-5">
            <Shimmer className="h-5 w-32 rounded-md" />
            <div className="mt-4 space-y-3">
              <Shimmer className="h-8 w-full rounded-xl" />
              <Shimmer className="h-8 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

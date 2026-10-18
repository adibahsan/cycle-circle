import { PageContainer } from '@/components/ui/PageContainer'
import { Shimmer } from '@/components/ui/Shimmer'

const PANEL = 'rounded-panel bg-[var(--color-bg-card)] border border-transparent shadow-panel'
const WIDE_CARDS = [
  { tint: 'bg-tint-pink', height: 'h-[300px]' },
  { tint: 'bg-tint-lavender', height: 'h-[300px]' },
  { tint: 'bg-tint-sky', height: 'h-[236px]' },
  { tint: 'bg-tint-sage', height: 'h-[236px]' },
]

/**
 * Skeleton in the symptoms page's shape: header, month grid on the left, then on the right the category tabs
 * and chip grid (below 2xl) or all four category cards (2xl and up).
 */
export default function SymptomsLoading() {
  return (
    <PageContainer width="canvas" className="gap-3 pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+5rem)] md:gap-5 xl:pb-4">
      <div>
        <Shimmer className="h-8 w-36 rounded-lg md:h-9" />
        <Shimmer className="mt-1.5 h-4 w-44 rounded-md" />
      </div>

      <div className="flex flex-col gap-3 md:gap-5 xl:flex-row xl:items-start">
        {/* Month grid */}
        <div className="flex flex-col gap-2 md:gap-3 xl:w-[400px] xl:shrink-0 2xl:w-[440px]">
          <div className={`${PANEL} px-2 py-2 sm:px-4 md:py-4`}>
            <div className="mb-1 flex items-center justify-between md:mb-2">
              <Shimmer className="h-11 w-11 rounded-xl" />
              <Shimmer className="h-5 w-32 rounded-md" />
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
                <Shimmer key={i} className="h-11 w-full rounded-xl md:h-12 2xl:h-16" />
              ))}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2 md:gap-4">
          {/* Tabs + chip grid (below 2xl) */}
          <div className="flex flex-col gap-2 md:gap-3 2xl:hidden">
            <div className="flex flex-col gap-2 md:gap-4 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between xl:gap-3">
              <div className="flex gap-1 rounded-full bg-[var(--color-bg-secondary)] p-1 xl:w-fit">
                {[0, 1, 2, 3].map((i) => (
                  <Shimmer key={i} className="h-10 flex-1 rounded-full md:h-11 xl:w-[89px] xl:flex-none" />
                ))}
              </div>
              <Shimmer className="order-first h-11 w-full rounded-full xl:order-last xl:w-[207px] xl:shrink-0" />
            </div>
            <div className="rounded-panel bg-tint-pink p-2 md:p-4">
              <div className="grid auto-rows-fr grid-cols-3 gap-1.5 md:gap-2 xl:grid-cols-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex h-[85px] flex-col items-center justify-center gap-2 rounded-2xl bg-[var(--color-bg-card)] p-1.5 md:h-[89px]">
                    <Shimmer className="h-8 w-8 rounded-full" />
                    <Shimmer className="h-3 w-14 rounded-md" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Every category at once (2xl and up) */}
          <div className="hidden flex-col gap-3 2xl:flex">
            <div className="flex items-center justify-between gap-3">
              <Shimmer className="h-4 w-48 rounded-md" />
              <Shimmer className="h-11 w-[207px] rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {WIDE_CARDS.map(({ tint, height }, i) => (
                <div key={i} className={`${height} rounded-panel p-3 ${tint}`}>
                  <Shimmer className="mx-1 mb-3 mt-0.5 h-4 w-24 rounded-md" />
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <Shimmer key={j} className="h-[72px] rounded-2xl" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

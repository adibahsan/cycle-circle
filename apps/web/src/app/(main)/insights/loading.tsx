import { PageContainer } from '@/components/ui/PageContainer'
import { Shimmer } from '@/components/ui/Shimmer'

const CARD = 'flex flex-col gap-3 rounded-panel bg-[var(--color-bg-card)] border border-transparent shadow-panel p-4 md:p-5'

/** Skeleton in the insights page's shape: header with the range chips, then the four chart cards (two across from xl). */
export default function InsightsLoading() {
  return (
    <PageContainer width="canvas">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Shimmer className="h-8 w-56 rounded-lg md:h-9" />
          <Shimmer className="mt-1.5 h-4 w-72 max-w-full rounded-md" />
        </div>
        <div className="flex items-center gap-1 sm:shrink-0">
          <Shimmer className="h-9 flex-1 rounded-full sm:w-[105px] sm:flex-none" />
          <Shimmer className="h-9 flex-1 rounded-full sm:w-[105px] sm:flex-none" />
          <Shimmer className="h-9 flex-1 rounded-full sm:w-[76px] sm:flex-none" />
          <Shimmer className="h-9 flex-1 rounded-full sm:w-[67px] sm:flex-none" />
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:grid xl:grid-cols-2">
        <div className={`${CARD} h-[296px] xl:h-[346px] 2xl:h-[406px]`}>
          <Shimmer className="h-5 w-40 rounded-md" />
          <Shimmer className="h-8 w-44 rounded-full" />
          <Shimmer className="w-full flex-1 rounded-2xl" />
        </div>
        <div className={`${CARD} h-[282px] xl:h-[346px] 2xl:h-[406px]`}>
          <Shimmer className="h-5 w-44 rounded-md" />
          <Shimmer className="h-4 w-48 rounded-md" />
          <Shimmer className="w-full flex-1 rounded-2xl" />
        </div>
        <div className={`${CARD} h-[217px] xl:h-[161px]`}>
          <Shimmer className="h-5 w-36 rounded-md" />
          <div className="grid flex-1 grid-cols-1 gap-3 xl:grid-cols-3">
            <div className="rounded-panel bg-tint-pink" />
            <div className="rounded-panel bg-tint-lavender" />
            <div className="rounded-panel bg-tint-mint" />
          </div>
        </div>
        <div className={`${CARD} h-[138px] xl:h-[161px]`}>
          <Shimmer className="h-5 w-40 rounded-md" />
          <Shimmer className="w-full flex-1 rounded-2xl" />
        </div>
      </div>
    </PageContainer>
  )
}

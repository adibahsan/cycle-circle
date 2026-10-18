import { PageContainer } from '@/components/ui/PageContainer'
import { Shimmer } from '@/components/ui/Shimmer'

const CARD = 'rounded-panel bg-[var(--color-bg-card)] border border-transparent dark:border-[var(--color-border)] shadow-panel p-5 space-y-3'

/** Skeleton in the insights page's shape: header + range control, then the chart cards. */
export default function InsightsLoading() {
  return (
    <PageContainer width="canvas">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Shimmer className="h-8 w-40 rounded-lg" />
          <Shimmer className="h-4 w-56 rounded-lg" />
        </div>
        <Shimmer className="h-9 w-full sm:w-64 rounded-xl" />
      </div>

      <div className="flex flex-col gap-5 2xl:grid 2xl:grid-cols-2 2xl:items-start">
        <div className={CARD}>
          <Shimmer className="h-5 w-40 rounded-md" />
          <Shimmer className="h-8 w-44 rounded-xl" />
          <Shimmer className="h-[180px] w-full rounded-2xl" />
        </div>
        <div className={CARD}>
          <Shimmer className="h-5 w-44 rounded-md" />
          <Shimmer className="h-4 w-48 rounded-md" />
          <Shimmer className="h-[160px] w-full rounded-2xl" />
        </div>
        <div className={CARD}>
          <Shimmer className="h-5 w-36 rounded-md" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Shimmer className="h-[88px] w-full rounded-panel" />
            <Shimmer className="h-[88px] w-full rounded-panel" />
            <Shimmer className="h-[88px] w-full rounded-panel" />
          </div>
        </div>
        <div className={CARD}>
          <Shimmer className="h-5 w-40 rounded-md" />
          <div className="space-y-2">
            <Shimmer className="h-12 w-full rounded-2xl" />
            <Shimmer className="h-12 w-full rounded-2xl" />
            <Shimmer className="h-12 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

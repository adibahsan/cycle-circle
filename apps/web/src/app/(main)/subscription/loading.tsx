import { PageContainer } from '@/components/ui/PageContainer'
import { Shimmer } from '@/components/ui/Shimmer'

const PANEL = 'rounded-panel border border-transparent shadow-panel bg-[var(--color-bg-card)]'
const ROW = 'flex h-[41px] items-center justify-between border-t border-[var(--color-border)] px-5 xl:h-[44px] 2xl:h-[51px]'

/**
 * Skeleton in the subscription page's shape (the Pro layout): header, the current plan card, and the
 * Free vs Pro table beside it from xl.
 */
export default function SubscriptionLoading() {
  return (
    <PageContainer width="canvas">
      <div>
        <Shimmer className="h-8 w-64 rounded-lg md:h-9" />
        <Shimmer className="mt-1.5 h-4 w-72 max-w-full rounded-md" />
      </div>

      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] xl:items-stretch xl:gap-5">
        <div className="flex flex-col gap-5 xl:self-start">
          <div className={`${PANEL} h-[294px] p-5`}>
            <div className="flex items-start justify-between">
              <Shimmer className="h-4 w-24 rounded-md" />
              <Shimmer className="h-7 w-16 rounded-full" />
            </div>
            <Shimmer className="mt-3 h-6 w-44 rounded-md" />
            <div className="mt-4 space-y-2.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Shimmer key={i} className="h-4 w-48 rounded-md" />
              ))}
            </div>
            <Shimmer className="mt-4 h-12 w-full rounded-full" />
          </div>
        </div>

        <div>
          <Shimmer className="mb-3 h-6 w-28 rounded-lg" />
          <div className={`${PANEL} overflow-hidden`}>
            <div className="flex h-[41px] items-center justify-between bg-tint-peach px-5 xl:h-[44px] 2xl:h-[51px]">
              <Shimmer className="h-4 w-16 rounded-md" />
              <Shimmer className="h-4 w-24 rounded-md" />
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={ROW}>
                <Shimmer className="h-4 w-32 rounded-md" />
                <Shimmer className="h-4 w-24 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

import { PageContainer } from '@/components/ui/PageContainer'
import { Shimmer } from '@/components/ui/Shimmer'

const CARD = 'rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] dark:border-transparent shadow-soft p-5 lg:flex-1'

/** Skeleton in the feedback page's shape: header, the form card (category tiles, rating, message, submit) and the history card. */
export default function FeedbackLoading() {
  return (
    <PageContainer width="canvas">
      <div>
        <Shimmer className="h-8 w-44 rounded-lg md:h-9" />
        <Shimmer className="mt-1.5 h-4 w-64 max-w-full rounded-md" />
      </div>

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-stretch">
        <div className="lg:flex lg:flex-col">
          <div className={CARD}>
            <Shimmer className="mb-3 h-4 w-20 rounded-md" />
            <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex h-[102px] flex-col 2xl:h-[149px] items-center gap-2 rounded-2xl bg-tint-pink p-3">
                  <Shimmer className="h-9 w-9 rounded-full" />
                  <Shimmer className="h-3 w-16 rounded-md" />
                </div>
              ))}
            </div>
            <Shimmer className="mb-3 h-4 w-28 rounded-md" />
            <div className="mb-5 flex h-8 items-center gap-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Shimmer key={i} className="h-8 w-8 rounded-full" />
              ))}
            </div>
            <Shimmer className="mb-3 h-4 w-32 rounded-md" />
            <Shimmer className="mb-5 h-28 w-full rounded-2xl" />
            <Shimmer className="h-14 w-full rounded-full" />
            <Shimmer className="mx-auto mt-2 h-3 w-40 rounded-md" />
          </div>
        </div>

        <div className="lg:flex lg:flex-col">
          <div className={`${CARD} flex flex-col`}>
            <Shimmer className="h-5 w-44 rounded-md" />
            <div className="flex flex-1 items-center justify-center py-8">
              <Shimmer className="h-4 w-64 max-w-full rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

import { PageContainer } from '@/components/ui/PageContainer'
import { Shimmer } from '@/components/ui/Shimmer'

const PILL_WIDTHS = ['w-[125px]', 'w-[122px]', 'w-[114px]', 'w-[119px]', 'w-[107px]']

/** Skeleton in the articles page's shape: header, phase filter pills, then the article card grid (one, two, three columns). */
export default function ContentLoading() {
  return (
    <PageContainer width="canvas" fill>
      <div>
        <Shimmer className="h-8 w-64 rounded-lg md:h-9" />
        <Shimmer className="mt-1.5 h-4 w-64 max-w-full rounded-md" />
      </div>

      <div className="-mx-4 mb-5 px-4">
        <div className="flex gap-2 overflow-hidden pb-1">
          {PILL_WIDTHS.map((w) => (
            <Shimmer key={w} className={`h-11 shrink-0 rounded-full ${w}`} />
          ))}
        </div>
      </div>

      <div>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${i >= 3 ? 'hidden sm:flex' : 'flex'} h-[132px] items-start justify-between gap-3 rounded-2xl bg-[var(--color-bg-card)] p-4 shadow-soft`}>
              <div className="min-w-0 flex-1 space-y-2">
                <Shimmer className="h-5 w-16 rounded-full" />
                <Shimmer className="h-4 w-3/4 rounded-md" />
                <Shimmer className="h-3 w-full rounded-md" />
                <Shimmer className="h-3 w-5/6 rounded-md" />
              </div>
              <Shimmer className="mt-1 h-5 w-5 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  )
}

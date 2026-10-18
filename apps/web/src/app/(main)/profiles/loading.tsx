import { PageContainer } from '@/components/ui/PageContainer'
import { Shimmer } from '@/components/ui/Shimmer'

/** Skeleton in the profiles page's shape: header, a profile card + the add-profile slot, then the data-isolation note. */
export default function ProfilesLoading() {
  return (
    <PageContainer width="canvas" className="min-h-[calc(100dvh-8rem)]">
      <div>
        <Shimmer className="h-8 w-40 rounded-lg md:h-9" />
        <Shimmer className="mt-1.5 h-4 w-28 rounded-md" />
      </div>

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-5 2xl:grid-cols-3">
        <div className="flex h-[107px] items-center gap-4 rounded-panel bg-[var(--color-bg-card)] border border-transparent shadow-panel p-4 lg:h-[83px]">
          <Shimmer className="h-11 w-11 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Shimmer className="h-5 w-28 rounded-md" />
            <Shimmer className="h-3 w-44 rounded-md" />
          </div>
          <Shimmer className="h-11 w-11 shrink-0 rounded-full" />
        </div>
        <div className="flex h-[82px] items-center justify-center gap-3 rounded-panel bg-tint-pink">
          <Shimmer className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Shimmer className="h-4 w-24 rounded-md" />
            <Shimmer className="h-3 w-32 rounded-md" />
          </div>
        </div>
        <div className="flex h-[110px] items-start gap-3 rounded-panel bg-tint-sage p-5 lg:col-span-2 lg:h-[78px] 2xl:col-span-3">
          <Shimmer className="h-5 w-5 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-2">
            <Shimmer className="h-4 w-28 rounded-md" />
            <Shimmer className="h-3 w-full rounded-md" />
            <Shimmer className="h-3 w-2/3 rounded-md lg:hidden" />
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

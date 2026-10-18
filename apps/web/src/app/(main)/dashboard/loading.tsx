import { PageContainer } from '@/components/ui/PageContainer';
import { Shimmer } from '@/components/ui/Shimmer';

const PANEL = 'rounded-panel bg-[var(--color-bg-card)] border border-transparent shadow-panel';
const TOOLKIT_TINTS = ['bg-tint-peach', 'bg-tint-pink', 'bg-tint-sky', 'bg-tint-lavender', 'bg-tint-mint', 'bg-tint-sage'];

/**
 * Skeleton in the dashboard's shape: header with the completion pill, then the same grid as DashboardClient
 * (hero + nudge, rail, journey + ring, toolkit) so the swap does not shift the layout.
 */
export default function DashboardLoading() {
  return (
    <PageContainer width="canvas">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Shimmer className="h-8 w-40 rounded-lg md:h-9" />
        <Shimmer className="h-11 w-full rounded-full sm:w-[238px] sm:shrink-0" />
      </div>

      <div className="flex flex-col gap-5 2xl:grid 2xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-rows-[auto_1fr] 2xl:gap-x-6">
        {/* Hero + logging nudge */}
        <div className="flex flex-col gap-5 2xl:col-start-1 2xl:row-start-1">
          <div className="h-[268px] rounded-panel bg-tint-pink p-5 sm:h-40">
            <Shimmer className="h-9 w-48 rounded-lg" />
            <Shimmer className="mt-3 h-4 w-64 max-w-full rounded-lg" />
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Shimmer className="h-12 rounded-full" />
              <Shimmer className="hidden h-12 rounded-full sm:block" />
              <Shimmer className="hidden h-12 rounded-full sm:block" />
            </div>
          </div>
          <div className={`${PANEL} h-[175px] p-5 sm:h-24`}>
            <Shimmer className="h-10 w-10 rounded-xl" />
          </div>
        </div>

        {/* Rail: streak, phase pattern, last period + predicted windows */}
        <div className="grid grid-cols-1 gap-4 lg:order-last lg:grid-cols-2 2xl:order-none 2xl:col-start-2 2xl:row-span-2 2xl:row-start-1 2xl:grid-cols-1 2xl:content-start">
          <div className={`${PANEL} h-[129px] p-5 lg:h-[204px] 2xl:h-[129px]`}>
            <Shimmer className="h-4 w-48 rounded-md" />
          </div>
          <div className={`${PANEL} h-[156px] p-5 lg:h-[204px] 2xl:h-[156px]`}>
            <Shimmer className="h-5 w-36 rounded-md" />
            <Shimmer className="mt-2 h-4 w-52 max-w-full rounded-md" />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:col-span-2 lg:grid-cols-2 2xl:col-span-1 2xl:grid-cols-1">
            <div className="h-[120px] rounded-panel bg-tint-pink p-5">
              <Shimmer className="h-5 w-28 rounded-md" />
            </div>
            <div className="h-[120px] rounded-panel bg-tint-mint p-5">
              <Shimmer className="h-5 w-36 rounded-md" />
            </div>
          </div>
        </div>

        {/* Journey + progress ring, toolkit (toolkit first from lg to 2xl) */}
        <div className="flex flex-col gap-5 2xl:col-start-1 2xl:row-start-2">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className={`${PANEL} h-[348px] p-5 lg:h-[229px]`}>
              <Shimmer className="h-5 w-40 rounded-md" />
              <Shimmer className="mt-4 h-24 w-full rounded-2xl" />
            </div>
            <div className={`${PANEL} h-[348px] p-5 lg:h-[229px]`}>
              <Shimmer className="h-5 w-36 rounded-md" />
              <Shimmer className="mt-4 h-24 w-full rounded-2xl" />
            </div>
          </div>
          <section className="lg:-order-1 2xl:order-none">
            <Shimmer className="mb-3 h-6 w-32 rounded-md" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {TOOLKIT_TINTS.map((tint) => (
                <div key={tint} className={`flex h-[76px] items-center gap-3 rounded-panel p-3 xl:h-[88px] 2xl:h-[78px] ${tint}`}>
                  <Shimmer className="h-10 w-10 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Shimmer className="h-4 w-24 rounded-md" />
                    <Shimmer className="h-3 w-full rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </PageContainer>
  );
}

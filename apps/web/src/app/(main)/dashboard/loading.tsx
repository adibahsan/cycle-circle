import { PageContainer } from '@/components/ui/PageContainer';
import { Shimmer } from '@/components/ui/Shimmer';

/** Skeleton in the dashboard's shape: header, hero, journey + ring panels, toolkit grid. */
export default function DashboardLoading() {
  return (
    <PageContainer width="canvas">
      <div className="space-y-2">
        <Shimmer className="h-8 w-48 rounded-lg" />
        <Shimmer className="h-4 w-32 rounded-lg" />
      </div>

      <div className="rounded-panel bg-tint-pink p-7 space-y-6">
        <Shimmer className="h-10 w-64 rounded-lg" />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Shimmer key={i} className="h-14 rounded-full" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-panel bg-[var(--color-bg-card)] shadow-panel p-5 min-h-[320px] space-y-4">
            <Shimmer className="h-5 w-40 rounded-lg" />
            <Shimmer className="h-56 w-full rounded-2xl" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Shimmer key={i} className="h-44 rounded-panel" />
        ))}
      </div>
    </PageContainer>
  );
}

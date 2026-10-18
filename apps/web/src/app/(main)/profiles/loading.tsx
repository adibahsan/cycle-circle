import { PageContainer } from '@/components/ui/PageContainer'
import { Shimmer } from '@/components/ui/Shimmer';

export default function ProfilesLoading() {
  return (
    <PageContainer width="canvas">
      {/* Page Header */}
      <div>
        <Shimmer className="h-7 w-36 rounded-lg" />
        <Shimmer className="h-4 w-28 rounded-md mt-1.5" />
      </div>

      {/* Grid of Profile Cards */}
      <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-panel border border-transparent shadow-panel bg-[var(--color-bg-card)] p-4 flex items-center justify-between gap-3 relative overflow-hidden"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Avatar placeholder */}
              <Shimmer className="w-11 h-11 rounded-full shrink-0" />
              
              {/* Info text rows */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Shimmer className="h-4.5 w-24 rounded-md" />
                  {i === 0 && <Shimmer className="h-4 w-12 rounded-full" />}
                </div>
                <div className="flex items-center gap-2">
                  <Shimmer className="h-4 w-12 rounded-full" />
                  <Shimmer className="h-3 w-32 rounded-md" />
                </div>
              </div>
            </div>

            {/* Edit/Delete actions */}
            <div className="flex gap-2">
              <Shimmer className="h-7 w-7 rounded-full" />
              {i !== 0 && <Shimmer className="h-7 w-7 rounded-full" />}
            </div>
          </div>
        ))}
      </div>

      {/* Add Profile dashed card placeholder */}
      <div className="mt-4 rounded-panel border border-dashed border-[var(--color-border)] p-4 flex items-center justify-center gap-2.5 bg-[var(--color-bg-secondary)]">
        <Shimmer className="w-10 h-10 rounded-full" />
        <div className="space-y-1.5 flex-1 max-w-[120px]">
          <Shimmer className="h-4 w-16 rounded-md" />
          <Shimmer className="h-3 w-24 rounded-md" />
        </div>
      </div>

      {/* Info notice banner */}
      <div className="mt-5 rounded-panel p-5 flex items-start gap-3 bg-tint-sage">
        <Shimmer className="h-6 w-6 rounded-full shrink-0" />
        <div className="space-y-2 flex-1">
          <Shimmer className="h-4 w-28 rounded-md" />
          <div className="space-y-1.5">
            <Shimmer className="h-3 w-full rounded-md" />
            <Shimmer className="h-3 w-5/6 rounded-md" />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

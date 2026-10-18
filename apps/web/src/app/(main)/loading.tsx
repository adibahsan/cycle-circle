import { PageContainer } from '@/components/ui/PageContainer';
import { Shimmer } from '@/components/ui/Shimmer';

/** Generic fallback for a (main) route without its own skeleton: the standard page header and one panel. */
export default function MainFallbackLoading() {
  return (
    <PageContainer width="canvas">
      <div>
        <Shimmer className="h-8 w-48 rounded-lg md:h-9" />
        <Shimmer className="mt-1.5 h-4 w-64 max-w-full rounded-md" />
      </div>

      <div className="space-y-5 rounded-panel border border-transparent bg-[var(--color-bg-card)] p-5 shadow-panel">
        <div className="space-y-3">
          <Shimmer className="h-6 w-1/4 rounded-lg" />
          <Shimmer className="h-4 w-full rounded-md" />
          <Shimmer className="h-4 w-5/6 rounded-md" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Shimmer className="h-32 rounded-panel" />
          <Shimmer className="h-32 rounded-panel" />
        </div>
      </div>
    </PageContainer>
  );
}

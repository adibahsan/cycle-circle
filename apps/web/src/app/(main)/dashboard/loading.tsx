import { Shimmer } from '@/components/ui/Shimmer';

export default function DashboardLoading() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 animate-pulse-soft">
      {/* Header greeting skeleton */}
      <div className="space-y-2">
        <Shimmer className="h-8 w-48 rounded-lg" />
        <Shimmer className="h-4 w-32 rounded-lg" />
      </div>

      {/* Main dashboard grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Large Cycle/Circle Card skeleton */}
        <div className="md:col-span-2 rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 flex flex-col items-center justify-center min-h-[320px] space-y-6">
          <Shimmer className="h-6 w-32 rounded-lg" />
          
          {/* Circular skeleton */}
          <div className="relative w-48 h-48 rounded-full border-4 border-[var(--color-border)] flex items-center justify-center">
            <div className="flex flex-col items-center space-y-2">
              <Shimmer className="h-4 w-16 rounded-md" />
              <Shimmer className="h-8 w-12 rounded-lg" />
              <Shimmer className="h-4 w-20 rounded-md" />
            </div>
          </div>

          <Shimmer className="h-10 w-44 rounded-2xl" />
        </div>

        {/* Sidebar widgets skeleton */}
        <div className="space-y-6">
          {/* Prediction card skeleton */}
          <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 space-y-4">
            <div className="flex justify-between items-center">
              <Shimmer className="h-5 w-24 rounded-lg" />
              <Shimmer className="h-8 w-8 rounded-lg" />
            </div>
            <div className="space-y-2">
              <Shimmer className="h-4 w-full rounded-md" />
              <Shimmer className="h-4 w-5/6 rounded-md" />
            </div>
            <Shimmer className="h-12 w-full rounded-2xl" />
          </div>

          {/* Quick actions card skeleton */}
          <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 space-y-4">
            <Shimmer className="h-5 w-28 rounded-lg" />
            <div className="grid grid-cols-2 gap-3">
              <Shimmer className="h-10 rounded-xl" />
              <Shimmer className="h-10 rounded-xl" />
            </div>
          </div>
        </div>
      </div>

      {/* Insights/List skeleton */}
      <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 space-y-4">
        <Shimmer className="h-5 w-36 rounded-lg" />
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-3">
              <Shimmer className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Shimmer className="h-4 w-28 rounded-md" />
                <Shimmer className="h-3 w-20 rounded-md" />
              </div>
            </div>
            <Shimmer className="h-6 w-16 rounded-full" />
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Shimmer className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Shimmer className="h-4 w-36 rounded-md" />
                <Shimmer className="h-3 w-16 rounded-md" />
              </div>
            </div>
            <Shimmer className="h-6 w-16 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

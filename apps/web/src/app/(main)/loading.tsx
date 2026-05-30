import { Shimmer } from '@/components/ui/Shimmer';

export default function MainFallbackLoading() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 animate-pulse-soft">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Shimmer className="h-8 w-40 rounded-lg" />
        <Shimmer className="h-4 w-60 rounded-lg" />
      </div>

      {/* Generic content card skeleton */}
      <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 space-y-6">
        <div className="space-y-3">
          <Shimmer className="h-6 w-1/4 rounded-lg" />
          <Shimmer className="h-4 w-full rounded-md" />
          <Shimmer className="h-4 w-5/6 rounded-md" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Shimmer className="h-32 rounded-2xl" />
          <Shimmer className="h-32 rounded-2xl" />
        </div>

        <div className="space-y-2">
          <Shimmer className="h-10 w-full rounded-xl" />
          <Shimmer className="h-10 w-32 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

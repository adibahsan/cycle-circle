import { Shimmer } from '@/components/ui/Shimmer';

export default function AuthLoading() {
  return (
    <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-soft p-6 w-full max-w-md mx-auto space-y-6 animate-pulse-soft">
      {/* Back button skeleton */}
      <Shimmer className="h-5 w-16 rounded-md" />

      {/* Header skeleton */}
      <div className="space-y-4 pt-4">
        {/* Icon skeleton */}
        <Shimmer className="h-14 w-14 rounded-2xl" />
        {/* Title & subtitle skeleton */}
        <div className="space-y-2">
          <Shimmer className="h-8 w-32 rounded-lg" />
          <Shimmer className="h-4 w-48 rounded-md" />
        </div>
      </div>

      {/* Input block skeleton */}
      <div className="space-y-2 pt-2">
        <Shimmer className="h-4 w-24 rounded-md" />
        <Shimmer className="h-12 w-full rounded-xl" />
      </div>

      {/* Button skeleton */}
      <Shimmer className="h-12 w-full rounded-2xl" />

      {/* Footer link skeleton */}
      <div className="flex justify-center pt-2">
        <Shimmer className="h-4 w-36 rounded-md" />
      </div>
    </div>
  );
}

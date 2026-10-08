import { PageContainer } from '@/components/ui/PageContainer'
import { Shimmer } from '@/components/ui/Shimmer';

export default function SubscriptionLoading() {
  return (
    <PageContainer className="animate-pulse-soft">
      {/* Page Title */}
      <div>
        <Shimmer className="h-8 w-44 rounded-lg" />
        <Shimmer className="h-4.5 w-60 rounded-md mt-1.5" />
      </div>

      {/* Current Plan + Upgrade card split row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Current Plan Card */}
        <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <Shimmer className="h-3 w-20 rounded-md" />
              <Shimmer className="h-6 w-24 rounded-md" />
            </div>
            <Shimmer className="h-7 w-16 rounded-full" />
          </div>

          <div className="space-y-2 pt-2">
            <Shimmer className="h-4 w-full rounded-md" />
            <Shimmer className="h-4 w-5/6 rounded-md" />
            <Shimmer className="h-4 w-4/5 rounded-md" />
          </div>
        </div>

        {/* Pro Upgrade Card */}
        <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Shimmer className="h-6 w-6 rounded-full" />
            <Shimmer className="h-6 w-20 rounded-md" />
          </div>

          <div className="space-y-1">
            <Shimmer className="h-8 w-24 rounded-lg" />
            <Shimmer className="h-3.5 w-48 rounded-md" />
          </div>

          <div className="space-y-2">
            <Shimmer className="h-4 w-full rounded-md" />
            <Shimmer className="h-4 w-11/12 rounded-md" />
            <Shimmer className="h-4 w-5/6 rounded-md" />
          </div>

          <Shimmer className="h-12 w-full rounded-xl" />
        </div>
      </div>

      {/* Comparison table */}
      <div className="space-y-3">
        <Shimmer className="h-5 w-32 rounded-lg" />
        <div className="rounded-2xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg-card)]">
          {/* Header Row */}
          <div className="grid grid-cols-3 bg-[var(--color-bg-secondary)] p-3">
            <Shimmer className="h-4 w-16 rounded-md col-span-1" />
            <div className="flex justify-center"><Shimmer className="h-4 w-10 rounded-md" /></div>
            <div className="flex justify-center"><Shimmer className="h-4 w-12 rounded-md" /></div>
          </div>
          {/* Rows */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid grid-cols-3 border-t border-[var(--color-border)] p-4">
              <Shimmer className="h-4 w-28 rounded-md col-span-1" />
              <div className="flex justify-center"><Shimmer className="h-4 w-4 rounded-full" /></div>
              <div className="flex justify-center"><Shimmer className="h-4 w-4 rounded-full" /></div>
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}

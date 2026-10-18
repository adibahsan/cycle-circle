import { PageContainer } from '@/components/ui/PageContainer'
import { Shimmer } from '@/components/ui/Shimmer';

export default function FeedbackLoading() {
  return (
    <PageContainer width="canvas">
      {/* Page Header */}
      <div>
        <Shimmer className="h-8 w-44 rounded-lg" />
        <Shimmer className="h-4.5 w-64 rounded-md mt-1.5" />
      </div>

      {/* Grid: Form Left, History Right */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Form Card */}
        <div>
          <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 space-y-5">
            {/* Category Selector Label */}
            <div className="space-y-3">
              <Shimmer className="h-3 w-16 rounded-md" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50 p-3 flex flex-col items-center gap-2">
                    <Shimmer className="h-9 w-9 rounded-xl" />
                    <Shimmer className="h-3 w-12 rounded-md" />
                  </div>
                ))}
              </div>
            </div>

            {/* Star Rating Section */}
            <div className="space-y-2.5">
              <Shimmer className="h-3 w-20 rounded-md" />
              <div className="flex gap-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Shimmer key={i} className="h-7 w-7 rounded-full" />
                ))}
              </div>
            </div>

            {/* Message Input Section */}
            <div className="space-y-2">
              <Shimmer className="h-3 w-28 rounded-md" />
              <Shimmer className="h-28 w-full rounded-xl" />
            </div>

            {/* Submit Button */}
            <Shimmer className="h-12 w-full rounded-2xl" />
          </div>
        </div>

        {/* Right Column: History Stack */}
        <div className="space-y-4">
          <Shimmer className="h-4.5 w-36 rounded-md" />
          
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-3"
              >
                <div className="flex justify-between items-center">
                  <Shimmer className="h-5 w-16 rounded-full" />
                  <Shimmer className="h-3 w-20 rounded-md" />
                </div>
                <div className="space-y-1.5">
                  <Shimmer className="h-3.5 w-full rounded-md" />
                  <Shimmer className="h-3.5 w-5/6 rounded-md" />
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Shimmer key={j} className="h-3.5 w-3.5 rounded-full" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

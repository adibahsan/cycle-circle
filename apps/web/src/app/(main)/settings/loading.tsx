import { Shimmer } from '@/components/ui/Shimmer';

export default function SettingsLoading() {
  return (
    <div className="py-4 space-y-6 animate-pulse-soft">
      {/* Title */}
      <div>
        <Shimmer className="h-8 w-32 rounded-lg" />
      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Section 1: Language & Appearance */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shimmer className="h-7 w-7 rounded-lg" />
              <Shimmer className="h-4 w-44 rounded-md" />
            </div>
            <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 space-y-5">
              <div className="flex justify-between items-center">
                <div className="space-y-1.5 flex-1">
                  <Shimmer className="h-4.5 w-24 rounded-md" />
                  <Shimmer className="h-3 w-36 rounded-md" />
                </div>
                <Shimmer className="h-8 w-24 rounded-xl" />
              </div>
              <div className="h-px bg-[var(--color-border)]" />
              <div className="flex justify-between items-center">
                <div className="space-y-1.5 flex-1">
                  <Shimmer className="h-4.5 w-16 rounded-md" />
                  <Shimmer className="h-3 w-28 rounded-md" />
                </div>
                <Shimmer className="h-8 w-28 rounded-xl" />
              </div>
            </div>
          </div>

          {/* Section 2: Notifications */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shimmer className="h-7 w-7 rounded-lg" />
              <Shimmer className="h-4 w-28 rounded-md" />
            </div>
            <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 divide-y divide-[var(--color-border)]">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex justify-between items-center py-3.5 first:pt-0 last:pb-0">
                  <div className="space-y-1.5 flex-1 pr-4">
                    <Shimmer className="h-4.5 w-32 rounded-md" />
                    <Shimmer className="h-3 w-48 rounded-md" />
                  </div>
                  <Shimmer className="h-6 w-11 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Section 3: Data Export */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shimmer className="h-7 w-7 rounded-lg" />
              <Shimmer className="h-4 w-28 rounded-md" />
            </div>
            <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 space-y-4">
              <Shimmer className="h-3 w-48 rounded-md" />
              <div className="grid grid-cols-2 gap-3">
                <Shimmer className="h-20 rounded-xl" />
                <Shimmer className="h-20 rounded-xl" />
              </div>
            </div>
          </div>

          {/* Section 4: Account */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shimmer className="h-7 w-7 rounded-lg" />
              <Shimmer className="h-4 w-24 rounded-md" />
            </div>
            <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 space-y-4">
              {/* Account info card */}
              <div className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-3 space-y-2">
                <div className="flex justify-between">
                  <Shimmer className="h-3 w-12 rounded-md" />
                  <Shimmer className="h-3 w-24 rounded-md" />
                </div>
                <div className="flex justify-between">
                  <Shimmer className="h-3 w-10 rounded-md" />
                  <Shimmer className="h-3 w-16 rounded-md" />
                </div>
              </div>

              {/* Account navigation list */}
              <div className="space-y-3.5 pt-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <Shimmer className="h-4.5 w-4.5 rounded-full" />
                      <Shimmer className="h-4 w-28 rounded-md" />
                    </div>
                    <Shimmer className="h-3.5 w-3.5 rounded" />
                  </div>
                ))}
              </div>

              {/* Logout button */}
              <Shimmer className="h-10 w-full rounded-xl mt-2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Shimmer } from '@/components/ui/Shimmer'

/** Skeleton in the onboarding shell's shape (CenteredShell card): header, progress dots, first step, nav. */
export default function OnboardingLoading() {
  return (
    <div
      aria-busy="true"
      className="relative min-h-dvh bg-[var(--color-bg-primary)] overflow-hidden flex items-stretch md:items-center justify-center md:p-6 lg:p-8"
    >
      <div className="relative z-10 w-full flex flex-col min-h-dvh max-w-md mx-auto bg-[var(--color-bg-card)] md:min-h-0 md:h-auto md:max-h-[92dvh] md:max-w-2xl lg:max-w-3xl md:rounded-[28px] md:border md:border-[var(--color-border)] md:shadow-glow md:overflow-hidden">
        <div className="shrink-0 px-5 pt-5 pb-3 md:px-7">
          <div className="flex items-center justify-between">
            <Shimmer className="h-6 w-28 rounded-lg" />
            <Shimmer className="h-8 w-28 rounded-full" />
          </div>
          <div className="mt-3 flex items-center gap-1.5 justify-center">
            <Shimmer className="h-2 w-6 rounded-full" />
            <Shimmer className="h-2 w-2 rounded-full" />
            <Shimmer className="h-2 w-2 rounded-full" />
            <Shimmer className="h-2 w-2 rounded-full" />
            <Shimmer className="h-2 w-2 rounded-full" />
          </div>
        </div>

        <div className="flex-1 min-h-0 px-5 py-6 md:px-8 md:py-8">
          <div className="flex flex-col items-center text-center gap-6 px-2 mx-auto w-full max-w-md lg:max-w-lg">
            <Shimmer className="mt-2 h-56 w-56 rounded-full" />
            <div className="space-y-3 flex flex-col items-center w-full">
              <Shimmer className="h-8 w-64 rounded-lg" />
              <Shimmer className="h-4 w-72 max-w-full rounded-md" />
              <Shimmer className="h-4 w-56 rounded-md" />
            </div>
            <Shimmer className="h-[68px] w-full max-w-xs lg:max-w-md rounded-2xl" />
            <Shimmer className="h-12 w-full mt-2 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}

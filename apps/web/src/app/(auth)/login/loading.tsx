import { Shimmer } from '@/components/ui/Shimmer';

export default function LoginLoading() {
  return (
    <div className="flex flex-col min-h-[calc(100dvh-4rem)]">
      {/* Logo / Hero section */}
      <div className="flex flex-col items-center pt-8 pb-6 space-y-4">
        {/* Floating icon */}
        <Shimmer className="h-14 w-14 rounded-2xl" />
        {/* Title */}
        <Shimmer className="h-9 w-24 rounded-lg" />
        {/* Subtitle */}
        <div className="flex flex-col items-center gap-1.5 w-full">
          <Shimmer className="h-4 w-48 rounded-md" />
          <Shimmer className="h-3.5 w-32 rounded-md" />
        </div>
      </div>

      {/* Input / Card section */}
      <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 space-y-5">
        <div className="space-y-1.5">
          <Shimmer className="h-6 w-24 rounded-md" />
          <Shimmer className="h-4 w-64 rounded-md" />
        </div>

        {/* Input */}
        <div className="space-y-2">
          <Shimmer className="h-4 w-28 rounded-md" />
          <div className="relative">
            <Shimmer className="h-12 w-full rounded-xl" />
          </div>
        </div>

        {/* Action Button */}
        <Shimmer className="h-12 w-full rounded-2xl" />
      </div>

      {/* Email Login Fallback Link */}
      <div className="flex justify-center pt-5">
        <Shimmer className="h-4 w-40 rounded-md" />
      </div>

      {/* Trust Footer */}
      <div className="mt-auto pt-8 pb-2 flex flex-col items-center gap-3">
        <Shimmer className="h-9 w-36 rounded-full" />
        <div className="flex flex-col items-center gap-1">
          <Shimmer className="h-3 w-56 rounded-md" />
          <Shimmer className="h-3 w-48 rounded-md" />
        </div>
      </div>
    </div>
  );
}

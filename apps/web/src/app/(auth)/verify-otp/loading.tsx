import { Shimmer } from '@/components/ui/Shimmer';

/** Skeleton in the OTP page's shape: back link, then one card with the icon tile, title, six digit boxes, button and resend line. */
export default function VerifyOtpLoading() {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
      <div className="mb-6 flex h-5 items-center self-start">
        <Shimmer className="h-4 w-16 rounded-md" />
      </div>

      <div className="rounded-3xl surface-wash border border-[var(--color-border)] shadow-soft p-6">
        <div className="mb-7">
          <Shimmer className="mb-4 h-14 w-14 rounded-2xl" />
          <Shimmer className="mb-2 h-7 w-44 rounded-lg" />
          <Shimmer className="mb-1.5 h-4 w-full rounded-md" />
          <Shimmer className="h-4 w-1/2 rounded-md" />
        </div>

        <div className="mb-5 flex justify-between gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Shimmer key={i} className="h-12 min-w-0 flex-1 rounded-full" />
          ))}
        </div>

        <Shimmer className="mb-5 h-[52px] w-full rounded-full" />

        <div className="flex flex-col items-center gap-1">
          <Shimmer className="h-4 w-36 rounded-md" />
          <Shimmer className="h-4 w-24 rounded-md" />
        </div>
      </div>

      <div className="mt-auto flex justify-center pt-6">
        <Shimmer className="h-3 w-56 rounded-md" />
      </div>
    </div>
  );
}

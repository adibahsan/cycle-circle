import { Shimmer } from '@/components/ui/Shimmer';

/** Skeleton in the login page's shape: logo, title and tagline, the phone-number card, the email link and the trust footer. */
export default function LoginLoading() {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
      <div className="flex flex-col items-center pb-6 pt-8">
        <Shimmer className="mb-4 h-16 w-16 rounded-full" />
        <Shimmer className="mb-1 h-9 w-52 rounded-lg" />
        <div className="flex flex-col items-center">
          <div className="flex h-[23px] items-center">
            <Shimmer className="h-4 w-40 rounded-md" />
          </div>
          <div className="flex h-[23px] items-center">
            <Shimmer className="h-4 w-32 rounded-md" />
          </div>
        </div>
      </div>

      <div className="rounded-3xl surface-wash border border-[var(--color-border)] shadow-soft p-6">
        <Shimmer className="mb-1 h-7 w-24 rounded-md" />
        <Shimmer className="mb-5 h-4 w-64 max-w-full rounded-md" />

        <div className="mb-5">
          <Shimmer className="mb-2 h-4 w-28 rounded-md" />
          <Shimmer className="h-[54px] w-full rounded-full" />
          <Shimmer className="mt-2 h-3 w-full rounded-md" />
          <Shimmer className="mt-1.5 h-3 w-3/4 rounded-md" />
        </div>

        <Shimmer className="h-[52px] w-full rounded-full" />
      </div>

      <div className="mt-4 flex h-5 items-center justify-center">
        <Shimmer className="h-4 w-44 rounded-md" />
      </div>

      <div className="mt-auto flex flex-col items-center gap-2 pb-2 pt-8">
        <Shimmer className="h-[34px] w-56 rounded-full" />
        <Shimmer className="h-3 w-60 max-w-full rounded-md" />
        <Shimmer className="h-3 w-24 rounded-md" />
      </div>
    </div>
  );
}

import { Shimmer } from '@/components/ui/Shimmer';

/**
 * Fallback skeleton for the auth routes without their own (email login): the same frame as the page, a back
 * link, then one card with the icon tile, title, notice, field and button.
 */
export default function AuthLoading() {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
      <div className="mb-6 flex h-5 items-center self-start">
        <Shimmer className="h-4 w-40 rounded-md" />
      </div>

      <div className="rounded-3xl surface-wash border border-[var(--color-border)] shadow-soft p-6">
        <div className="mb-7">
          <Shimmer className="mb-4 h-14 w-14 rounded-2xl" />
          <Shimmer className="mb-2 h-7 w-40 rounded-lg" />
          <Shimmer className="mb-1.5 h-4 w-full rounded-md" />
          <Shimmer className="h-4 w-2/3 rounded-md" />
        </div>

        <Shimmer className="mb-5 h-[88px] w-full rounded-2xl" />

        <div className="mb-5 space-y-2">
          <Shimmer className="h-4 w-28 rounded-md" />
          <Shimmer className="h-[50px] w-full rounded-full" />
        </div>

        <Shimmer className="mt-8 h-[52px] w-full rounded-full" />
      </div>

      <div className="mt-auto flex justify-center pb-2 pt-6">
        <Shimmer className="h-4 w-56 rounded-md" />
      </div>
    </div>
  );
}

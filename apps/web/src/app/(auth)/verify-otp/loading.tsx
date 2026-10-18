import { Shimmer } from '@/components/ui/Shimmer';

export default function VerifyOtpLoading() {
  return (
    <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-soft p-6 w-full max-w-md mx-auto space-y-6">
      {/* Back link */}
      <Shimmer className="h-5 w-16 rounded-md" />

      <div className="space-y-4 pt-4">
        <Shimmer className="h-14 w-14 rounded-2xl" />
        <div className="space-y-2">
          <Shimmer className="h-8 w-32 rounded-lg" />
          <Shimmer className="h-4 w-48 rounded-md" />
        </div>
      </div>

      {/* Six digit boxes */}
      <div className="flex justify-between gap-2 pt-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Shimmer key={i} className="h-12 w-12 rounded-full" />
        ))}
      </div>

      <Shimmer className="h-12 w-full rounded-2xl" />

      <div className="flex justify-center pt-2">
        <Shimmer className="h-4 w-36 rounded-md" />
      </div>
    </div>
  );
}

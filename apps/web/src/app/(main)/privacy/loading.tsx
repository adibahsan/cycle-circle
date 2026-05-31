import { Shimmer } from '@/components/ui/Shimmer';

export default function PrivacyLoading() {
  return (
    <div className="py-4 space-y-5 animate-pulse-soft">
      <div>
        <Shimmer className="h-7 w-48 rounded-lg" />
        <Shimmer className="h-4 w-72 rounded-md mt-1.5" />
      </div>

      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Shimmer className="h-5 w-40 rounded-md" />
            <Shimmer className="h-3.5 w-full rounded-md" />
            <Shimmer className="h-3.5 w-5/6 rounded-md" />
            <Shimmer className="h-3.5 w-4/6 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

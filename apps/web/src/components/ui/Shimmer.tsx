export function Shimmer({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-xl bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent animate-shimmer opacity-50 ${className}`}
    />
  );
}

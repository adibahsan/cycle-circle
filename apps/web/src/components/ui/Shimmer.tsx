export function Shimmer({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-xl bg-[var(--color-border)] opacity-50 ${className}`}
    />
  );
}

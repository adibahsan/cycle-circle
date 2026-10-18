import { cn } from '@/lib/cn';

export function Shimmer({ className = '' }: { className?: string }) {
  return (
    // cn(): a caller's radius (e.g. rounded-full) replaces the default instead of fighting it.
    <div aria-hidden="true" className={cn('rounded-xl bg-[var(--color-border)] opacity-50', className)} />
  );
}

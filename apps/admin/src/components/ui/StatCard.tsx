import { useId } from 'react';
import { clsx } from 'clsx';
import { Card } from './Card';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: { value: number; label: string };
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ title, value, change, icon, className }: StatCardProps) {
  const titleId = useId();
  const isPositive = change && change.value >= 0;
  const isNegative = change && change.value < 0;

  return (
    <Card className={clsx('flex flex-col gap-3', className)}>
      <div role="group" aria-labelledby={titleId} className="flex flex-col gap-3">
      <div className="flex items-start justify-between">
        {/* aria-hidden: the group's name already announces the title; the value paragraph is the only content read after it. */}
        <p id={titleId} aria-hidden="true" className="text-sm font-medium text-[var(--color-text-muted)]">{title}</p>
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-primary)]">
            {icon}
          </div>
        )}
      </div>

      <p className="text-3xl font-bold tracking-tight tabular-nums text-[var(--color-text-primary)]">
        {value}
      </p>

      {change && (
        <div
          className={clsx('flex items-center gap-1 text-sm font-medium', {
            'text-[var(--color-success)]': isPositive,
            'text-[var(--color-danger)]': isNegative,
          })}
        >
          {isPositive && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="h-4 w-4 shrink-0"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8 14a.75.75 0 0 1-.75-.75V4.56L4.03 7.78a.75.75 0 0 1-1.06-1.06l4.5-4.5a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1-1.06 1.06L8.75 4.56v8.69A.75.75 0 0 1 8 14Z"
                clipRule="evenodd"
              />
            </svg>
          )}
          {isNegative && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="h-4 w-4 shrink-0"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8 2a.75.75 0 0 1 .75.75v8.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 0 1 1.06-1.06L7.25 11.44V2.75A.75.75 0 0 1 8 2Z"
                clipRule="evenodd"
              />
            </svg>
          )}
          <span>
            {isPositive ? '+' : ''}
            {change.value}% {change.label}
          </span>
        </div>
      )}
      </div>
    </Card>
  );
}

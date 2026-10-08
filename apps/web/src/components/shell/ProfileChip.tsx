'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import type { ProfileCompletionStatus } from '@/lib/profile-completion';

const SIZE = 28;
const STROKE = 3;

/**
 * The one profile control in the shell: active profile name linking to /profiles,
 * with a completion ring (a button that opens the completion pop-up) while below 100%.
 */
export function ProfileChip({
  name,
  status,
  onOpenCompletion,
  className = '',
}: {
  name: string;
  status: ProfileCompletionStatus | null;
  onOpenCompletion: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const label = name || t('profileCompletion.headerLabel');
  const incomplete = !!status && !status.complete;
  const r = (SIZE - STROKE) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div
      className={`inline-flex items-center min-w-0 max-w-full rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] ${className}`}
    >
      {incomplete ? (
        <button
          type="button"
          data-tour="profile-ring"
          onClick={onOpenCompletion}
          aria-label={t('profileCompletion.headerAriaLabel', { percent: status.percent })}
          className="relative shrink-0 m-0.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]"
          style={{ width: SIZE, height: SIZE }}
        >
          <svg width={SIZE} height={SIZE} className="-rotate-90" aria-hidden="true">
            <circle cx={SIZE / 2} cy={SIZE / 2} r={r} fill="none" stroke="var(--color-border-strong)" strokeWidth={STROKE} />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={r}
              fill="none"
              stroke="var(--goal-accent)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - status.percent / 100)}
            />
          </svg>
          <Users size={12} aria-hidden="true" className="absolute inset-0 m-auto text-[var(--color-text-secondary)]" />
        </button>
      ) : (
        <span className="shrink-0 pl-2.5 text-[var(--color-text-secondary)]" aria-hidden="true">
          <Users aria-hidden="true" size={14} />
        </span>
      )}
      <Link
        href="/profiles"
        aria-label={t('nav.profileSwitcher', { name: label })}
        className="min-w-0 truncate rounded-full py-1.5 pl-1.5 pr-3 text-sm font-medium text-[var(--color-text-primary)] hover:text-[var(--goal-accent)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]"
      >
        {label}
      </Link>
    </div>
  );
}

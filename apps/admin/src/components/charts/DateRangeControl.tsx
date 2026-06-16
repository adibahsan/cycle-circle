'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

// ── Public types ──────────────────────────────────────────────────────────

export interface DateRangeOption {
  value: string
  label: string
  days: number
}

export interface DateRangeControlProps {
  paramKey?: string
  options?: DateRangeOption[]
  className?: string
}

// ── Defaults ──────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: DateRangeOption[] = [
  { value: '7d',  label: '7d',  days: 7 },
  { value: '30d', label: '30d', days: 30 },
  { value: '90d', label: '90d', days: 90 },
  { value: '1y',  label: '1y',  days: 365 },
]

// ── DateRangeControl ──────────────────────────────────────────────────────

export function DateRangeControl({
  paramKey = 'range',
  options = DEFAULT_OPTIONS,
  className,
}: DateRangeControlProps): React.JSX.Element {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Determine the active option: use URL param value if it matches an option,
  // otherwise fall back to the option whose days === 30, then the first option.
  const currentValue = searchParams.get(paramKey)
  const defaultOption =
    options.find((o) => o.days === 30) ?? options[0]

  const activeOption =
    options.find((o) => o.value === currentValue) ?? defaultOption

  function handleSelect(option: DateRangeOption) {
    if (option.value === activeOption.value) return

    const params = new URLSearchParams(searchParams.toString())
    params.set(paramKey, option.value)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div
      role="group"
      aria-label="Date range"
      className={[
        'flex items-center gap-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-0.5',
        className ?? '',
      ]
        .join(' ')
        .trim()}
    >
      {options.map((option) => {
        const isActive = option.value === activeOption.value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => handleSelect(option)}
            className={[
              'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1',
              isActive
                ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-soft'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
            ].join(' ')}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

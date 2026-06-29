'use client'

import { useTransition, useState } from 'react'
import { ServerCog, Play } from 'lucide-react'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { triggerDailyReminders, triggerCaasCheck } from '@/app/actions/system-actions'
import type { CronJobResult } from '@/app/actions/system-actions'

function CountsDisplay({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts)
  if (entries.length === 0) return null
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-col">
          <dt className="text-xs font-medium text-[var(--color-text-muted)] capitalize">
            {key.replace(/([A-Z])/g, ' $1').trim()}
          </dt>
          <dd className="text-lg font-bold tabular-nums text-[var(--color-text-primary)]">
            {typeof value === 'number' ? value : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

interface JobCardProps {
  title: string
  caption: string
  schedule: string
  result: CronJobResult | null
  isPending: boolean
  onRun: () => void
}

function JobCard({ title, caption, schedule, result, isPending, onRun }: JobCardProps) {
  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{caption}</p>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            Production schedule: {schedule}
          </p>
        </div>
        <div className="shrink-0">
          <Button
            size="sm"
            loading={isPending}
            onClick={onRun}
            disabled={isPending}
            aria-label={`Run ${title} cron job now`}
          >
            <Play size={13} aria-hidden="true" />
            Run now
          </Button>
        </div>
      </div>

      {result !== null && (
        <div
          aria-live="polite"
          className={`mt-4 rounded-xl border px-4 py-3 ${
            result.ok
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
              : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40'
          }`}
        >
          {result.error && (
            <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
              {result.error}
            </p>
          )}
          {result.ok && !result.error && (
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Job completed successfully.
            </p>
          )}
          {result.counts && Object.keys(result.counts).length > 0 && (
            <CountsDisplay counts={result.counts} />
          )}
        </div>
      )}
    </Card>
  )
}

export function SystemClient() {
  const [remindersResult, setRemindersResult] = useState<CronJobResult | null>(null)
  const [caasResult, setCaasResult] = useState<CronJobResult | null>(null)

  const [isRemindingPending, startReminders] = useTransition()
  const [isCaasPending, startCaas] = useTransition()

  function handleRunReminders() {
    startReminders(async () => {
      const result = await triggerDailyReminders()
      setRemindersResult(result)
    })
  }

  function handleRunCaas() {
    startCaas(async () => {
      const result = await triggerCaasCheck()
      setCaasResult(result)
    })
  }

  return (
    <div className="space-y-6 page-enter">
      <AdminPageHeader
        title="System"
        description="Manually trigger scheduled cron jobs and inspect their results."
        tags={[]}
      />

      <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
        <ServerCog size={16} aria-hidden="true" className="shrink-0" />
        <span>
          These jobs normally run on a schedule. Triggering them manually will execute against
          the live web app and write audit logs.
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
        <JobCard
          title="Daily reminders"
          caption="Sends period alerts, fertile window alerts, logging reminders, and profile-completion nudges to active subscribers."
          schedule="08:00 UTC daily"
          result={remindersResult}
          isPending={isRemindingPending}
          onRun={handleRunReminders}
        />

        <JobCard
          title="Subscription check"
          caption="Re-checks Pro subscribers' CAAS balance; lapses subscriptions after repeated billing failures."
          schedule="02:00 UTC daily"
          result={caasResult}
          isPending={isCaasPending}
          onRun={handleRunCaas}
        />
      </div>
    </div>
  )
}

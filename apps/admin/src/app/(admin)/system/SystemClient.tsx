'use client'

import { useTransition, useState } from 'react'
import { ServerCog, Play } from 'lucide-react'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'
import {
  triggerDailyReminders,
  triggerCaasCheck,
  setCronEnabledAction,
} from '@/app/actions/system-actions'
import { SmsSendTimeCard } from './SmsSendTimeCard'
import type { CronJobResult, CronSlug } from '@/app/actions/system-actions'

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
  slug: CronSlug
  enabled: boolean
  isToggling: boolean
  onToggle: () => void
}

function JobCard({
  title,
  caption,
  schedule,
  result,
  isPending,
  onRun,
  slug: _slug,
  enabled,
  isToggling,
  onToggle,
}: JobCardProps) {
  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{caption}</p>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            Production schedule: {schedule}
          </p>

          {/* Daily schedule toggle */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--color-text-muted)]">
              Daily schedule
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label={`Daily schedule for ${title}`}
              disabled={isToggling}
              onClick={onToggle}
              className={[
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
                'transition-colors focus-visible:outline-none focus-visible:ring-2',
                'focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                enabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border-strong)]',
              ].join(' ')}
            >
              <span
                aria-hidden="true"
                className={[
                  'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm',
                  'transition-transform',
                  enabled ? 'translate-x-5' : 'translate-x-0',
                ].join(' ')}
              />
            </button>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
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
          <p className="text-xs text-[var(--color-text-muted)]">
            Runs immediately, even when the daily schedule is off.
          </p>
        </div>
      </div>

      {result !== null && (
        <div
          aria-live="polite"
          className={`mt-4 rounded-xl border px-4 py-3 ${
            result.ok
              ? 'border-[var(--color-success)] bg-[var(--color-success-bg)]'
              : 'border-[var(--color-danger)] bg-[var(--color-danger-bg)]'
          }`}
        >
          {result.error && (
            <p role="alert" className="text-sm font-medium text-[var(--color-danger)]">
              {result.error}
            </p>
          )}
          {result.ok && !result.error && (
            <p className="text-sm font-medium text-[var(--color-success)]">
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

export function SystemClient({
  initialSettings,
  initialSmsSendTime,
}: {
  initialSettings: Record<CronSlug, boolean>
  initialSmsSendTime: string
}) {
  const [remindersResult, setRemindersResult] = useState<CronJobResult | null>(null)
  const [caasResult, setCaasResult] = useState<CronJobResult | null>(null)
  const [settings, setSettings] = useState(initialSettings)
  const [togglingSlug, setTogglingSlug] = useState<CronSlug | null>(null)

  const [isRemindingPending, startReminders] = useTransition()
  const [isCaasPending, startCaas] = useTransition()
  const [, startToggle] = useTransition()

  const toast = useToast()
  const [confirmSlug, setConfirmSlug] = useState<'daily-reminders' | 'caas-check' | null>(null)

  function report(label: string, result: CronJobResult) {
    if (result.ok) toast.success(`${label} finished`)
    else toast.error(result.error ?? `${label} failed`)
  }

  function runSafely(label: string, job: () => Promise<CronJobResult>, set: (r: CronJobResult) => void) {
    return async () => {
      try {
        const result = await job()
        set(result)
        report(label, result)
      } catch (err) {
        toast.error(err instanceof Error && err.message ? err.message : `${label} failed`)
      }
    }
  }

  function handleConfirmRun() {
    const slug = confirmSlug
    setConfirmSlug(null)
    if (slug === 'daily-reminders') {
      startReminders(runSafely('Daily reminders', triggerDailyReminders, setRemindersResult))
    } else if (slug === 'caas-check') {
      startCaas(runSafely('Daily subscription check', triggerCaasCheck, setCaasResult))
    }
  }

  function handleToggle(slug: CronSlug) {
    if (togglingSlug !== null) return
    const prev = settings[slug]
    const next = !prev
    // Optimistic update
    setSettings((s) => ({ ...s, [slug]: next }))
    setTogglingSlug(slug)
    startToggle(async () => {
      const res = await setCronEnabledAction(slug, next)
      if (!res.ok) {
        // Revert on failure
        setSettings((s) => ({ ...s, [slug]: prev }))
      }
      setTogglingSlug(null)
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
          onRun={() => setConfirmSlug('daily-reminders')}
          slug="daily-reminders"
          enabled={settings['daily-reminders']}
          isToggling={togglingSlug === 'daily-reminders'}
          onToggle={() => handleToggle('daily-reminders')}
        />

        <JobCard
          title="Daily subscription check"
          caption="Asks BDApps whether each Pro subscriber is still subscribed (subscriber status). Downgrades numbers BDApps reports as unsubscribed and restores revoked users who re-subscribed."
          schedule="02:00 UTC daily"
          result={caasResult}
          isPending={isCaasPending}
          onRun={() => setConfirmSlug('caas-check')}
          slug="caas-check"
          enabled={settings['caas-check']}
          isToggling={togglingSlug === 'caas-check'}
          onToggle={() => handleToggle('caas-check')}
        />
      </div>

      <SmsSendTimeCard initialTime={initialSmsSendTime} />

      <ConfirmModal
        open={confirmSlug !== null}
        onClose={() => setConfirmSlug(null)}
        onConfirm={handleConfirmRun}
        title={confirmSlug === 'caas-check' ? 'Run the daily subscription check now?' : 'Send daily reminders now?'}
        message={
          confirmSlug === 'caas-check'
            ? 'It calls the live BDApps subscriber-status API for every Pro subscriber.'
            : 'This sends real reminder emails and notifications to active subscribers.'
        }
        confirmLabel="Run now"
        variant="warning"
      />
    </div>
  )
}

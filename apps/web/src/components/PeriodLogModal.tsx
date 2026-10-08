'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useTranslation } from 'react-i18next'
import type { FlowIntensity } from '@vesta/shared/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { deviceDayString } from '@/lib/local-date'
import { createPeriodLog, updatePeriodLog } from '@/app/actions/tracking-actions'
import '@vesta/shared/utils/i18n'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** UI FlowIntensity -> Prisma enum */
function toActionFlow(f: FlowIntensity): 'LIGHT' | 'MEDIUM' | 'HEAVY' {
  return f.toUpperCase() as 'LIGHT' | 'MEDIUM' | 'HEAVY'
}

export const FLOW_COLORS: Record<FlowIntensity, string> = {
  light: 'var(--color-follicular)',
  medium: 'var(--color-primary)',
  heavy: 'var(--color-menstrual)',
}

/** Text colour for content rendered on a FLOW_COLORS fill. */
export const FLOW_TEXT: Record<FlowIntensity, string> = {
  light: 'var(--color-on-follicular)',
  medium: 'var(--color-on-accent)',
  heavy: 'var(--color-on-menstrual)',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface LogModalProps {
  open: boolean
  profileId: string
  existingLogId?: string
  initialStart?: string
  initialEnd?: string
  initialFlow?: FlowIntensity
  onClose: () => void
  /** Called after a successful save, right before `onClose`. */
  onSaved: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PeriodLogModal({
  open,
  profileId,
  existingLogId,
  initialStart = '',
  initialEnd = '',
  initialFlow = 'medium',
  onClose,
  onSaved,
}: LogModalProps) {
  const { t } = useTranslation()

  // While closing, the parent may already have cleared the log being edited; keep the
  // title and form stable until the exit animation is done.
  const frozen = useRef({ profileId, existingLogId })
  if (open) frozen.current = { profileId, existingLogId }
  const { profileId: logProfileId, existingLogId: logId } = frozen.current

  const isEdit = Boolean(logId)
  const todayStr = deviceDayString()
  const [startDate, setStartDate] = useState(initialStart || (isEdit ? '' : todayStr))
  const [endDate, setEndDate] = useState(initialEnd || (isEdit ? '' : todayStr))
  const [flow, setFlow] = useState<FlowIntensity>(initialFlow)
  const [error, setError] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Fresh form each time the pop-up opens.
  useEffect(() => {
    if (!open) return
    const edit = Boolean(existingLogId)
    const today = deviceDayString()
    setStartDate(initialStart || (edit ? '' : today))
    setEndDate(initialEnd || (edit ? '' : today))
    setFlow(initialFlow)
    setError(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleSave = () => {
    if (!startDate || !endDate) return
    setError(false)
    startTransition(async () => {
      try {
        if (isEdit && logId) {
          await updatePeriodLog(logId, {
            startDate,
            endDate,
            flowIntensity: toActionFlow(flow),
          })
        } else {
          await createPeriodLog({
            profileId: logProfileId,
            startDate,
            endDate,
            flowIntensity: toActionFlow(flow),
          })
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('vesta:profile-updated'))
        }
        onSaved()
        onClose()
      } catch (err) {
        console.error('Failed to save period log:', err)
        setError(true)
      }
    })
  }

  const title = isEdit ? t('dashboard.editPeriodLog') : t('dashboard.logPeriod')

  const header = (
    <div className="px-5 pt-6 pb-3 pr-14">
      <h2 id="period-log-title" className="text-lg font-bold text-[var(--color-text-primary)]">
        {title}
      </h2>
      <p id="period-log-desc" className="text-xs text-[var(--color-text-muted)] mt-0.5">
        {t('dashboard.logPeriodMotivation')}
      </p>
    </div>
  )

  const footer = (
    <div className="px-5 pt-3 pb-5">
      {error && (
        <p role="alert" className="mb-2 text-sm text-[var(--color-error)]">
          {t('common.error')}
        </p>
      )}
      <Button
        variant="primary"
        fullWidth
        size="lg"
        onClick={handleSave}
        disabled={!startDate || !endDate || isPending}
      >
        {isPending ? t('common.loading') : isEdit ? t('dashboard.updateLog') : t('dashboard.savePeriod')}
      </Button>
    </div>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId="period-log-title"
      descId="period-log-desc"
      header={header}
      footer={footer}
    >
      <div className="px-5 pt-1 pb-3">
        {/* Start date */}
        <div className="mb-4">
          <label htmlFor="period-start-date" className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
            {t('dashboard.startDate')}
          </label>
          <input
            id="period-start-date"
            type="date"
            aria-label={t('dashboard.startDate')}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            max={todayStr}
            className="w-full rounded-xl border px-3 py-2.5 text-sm font-medium text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)] transition-colors duration-150"
            style={{ borderColor: 'var(--color-border)' }}
          />
        </div>

        {/* End date */}
        <div className="mb-5">
          <label htmlFor="period-end-date" className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
            {t('dashboard.endDate')}
          </label>
          <input
            id="period-end-date"
            type="date"
            aria-label={t('dashboard.endDate')}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate || undefined}
            max={todayStr}
            className="w-full rounded-xl border px-3 py-2.5 text-sm font-medium text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)] transition-colors duration-150"
            style={{ borderColor: 'var(--color-border)' }}
          />
        </div>

        {/* Flow intensity */}
        <div role="group" aria-labelledby="flow-intensity-label">
          <span id="flow-intensity-label" className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-2.5 uppercase tracking-wider">
            {t('dashboard.flowIntensity')}
          </span>
          <div className="flex gap-2">
            {(['light', 'medium', 'heavy'] as FlowIntensity[]).map((f) => (
              <button
                key={f}
                onClick={() => setFlow(f)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
                  flow === f
                    ? 'shadow-soft'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)]'
                }`}
                style={
                  flow === f
                    ? { backgroundColor: FLOW_COLORS[f], borderColor: FLOW_COLORS[f], color: FLOW_TEXT[f] }
                    : {}
                }
              >
                <span className="mr-1">
                  {f === 'light' ? '💧' : f === 'medium' ? '🩸' : '🌊'}
                </span>
                {t(`dashboard.flow${f.charAt(0).toUpperCase() + f.slice(1)}`)}
              </button>
            ))}
          </div>
        </div>

      </div>
    </Modal>
  )
}

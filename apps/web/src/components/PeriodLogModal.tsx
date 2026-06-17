'use client'

import { useState, useTransition, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'
import type { FlowIntensity } from '@vesta/shared/types'
import { parseISO } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { createPeriodLog, updatePeriodLog } from '@/app/actions/tracking-actions'
import '@vesta/shared/utils/i18n'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** UI FlowIntensity -> Prisma enum */
function toActionFlow(f: FlowIntensity): 'LIGHT' | 'MEDIUM' | 'HEAVY' {
  return f.toUpperCase() as 'LIGHT' | 'MEDIUM' | 'HEAVY'
}

export const FLOW_COLORS: Record<FlowIntensity, string> = {
  light: '#F2728E',
  medium: '#E8476C',
  heavy: '#C93558',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface LogModalProps {
  profileId: string
  existingLogId?: string
  initialStart?: string
  initialEnd?: string
  initialFlow?: FlowIntensity
  onClose: () => void
  onSaved: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PeriodLogModal({
  profileId,
  existingLogId,
  initialStart = '',
  initialEnd = '',
  initialFlow = 'medium',
  onClose,
  onSaved,
}: LogModalProps) {
  const { t } = useTranslation()
  const prefersReducedMotion = useReducedMotion()
  const [startDate, setStartDate] = useState(initialStart)
  const [endDate, setEndDate] = useState(initialEnd)
  const [flow, setFlow] = useState<FlowIntensity>(initialFlow)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  const isEdit = Boolean(existingLogId)

  const handleSave = () => {
    if (!startDate || !endDate) return
    startTransition(async () => {
      try {
        if (isEdit && existingLogId) {
          await updatePeriodLog(existingLogId, {
            startDate,
            endDate,
            flowIntensity: toActionFlow(flow),
          })
        } else {
          await createPeriodLog({
            profileId,
            startDate,
            endDate,
            flowIntensity: toActionFlow(flow),
          })
        }
        setSaved(true)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('vesta:profile-updated'))
        }
        onSaved()
        setTimeout(onClose, 700)
      } catch (err) {
        console.error('Failed to save period log:', err)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onKeyDown={handleKeyDown}>
      {/* Backdrop — does not close the modal on click; use the ✕ button or save instead */}
      <motion.div
        className="absolute inset-0 bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? t('dashboard.editPeriodLog') : t('dashboard.logPeriod')}
        className="relative w-full max-w-md max-h-[85dvh] overflow-y-auto overscroll-contain bg-[var(--color-bg-card)] rounded-t-3xl sm:rounded-3xl px-5 py-6 shadow-2xl"
        initial={prefersReducedMotion ? { opacity: 0 } : { y: '100%' }}
        animate={prefersReducedMotion ? { opacity: 1 } : { y: 0 }}
        exit={
          prefersReducedMotion
            ? { opacity: 0, transition: { duration: 0.15 } }
            : { y: '100%', transition: { type: 'tween', duration: 0.2, ease: 'easeIn' } }
        }
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--color-border)] sm:hidden" />

        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              {isEdit ? t('dashboard.editPeriodLog') : t('dashboard.logPeriod')}
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {t('dashboard.logPeriodMotivation')}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <X size={18} className="text-[var(--color-text-muted)]" aria-hidden="true" />
          </button>
        </div>

        {/* Start date */}
        <div className="mb-4">
          <label htmlFor="period-start-date" className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
            {t('dashboard.startDate')}
          </label>
          <DatePicker
            id="period-start-date"
            aria-label={t('dashboard.startDate')}
            value={startDate}
            onChange={setStartDate}
            maxDate={new Date()}
          />
        </div>

        {/* End date */}
        <div className="mb-5">
          <label htmlFor="period-end-date" className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
            {t('dashboard.endDate')}
          </label>
          <DatePicker
            id="period-end-date"
            aria-label={t('dashboard.endDate')}
            value={endDate}
            onChange={setEndDate}
            minDate={startDate ? parseISO(startDate) : undefined}
            maxDate={new Date()}
          />
        </div>

        {/* Flow intensity */}
        <div role="group" aria-labelledby="flow-intensity-label" className="mb-6">
          <span id="flow-intensity-label" className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-2.5 uppercase tracking-wider">
            {t('dashboard.flowIntensity')}
          </span>
          <div className="flex gap-2">
            {(['light', 'medium', 'heavy'] as FlowIntensity[]).map((f) => (
              <button
                key={f}
                onClick={() => setFlow(f)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                  flow === f
                    ? 'text-white shadow-soft'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)]'
                }`}
                style={
                  flow === f
                    ? { backgroundColor: FLOW_COLORS[f], borderColor: FLOW_COLORS[f] }
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

        {/* Save */}
        <div aria-live="polite">
          <AnimatePresence mode="wait">
            {saved ? (
              <motion.div
                key="saved"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full py-3 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-center font-semibold"
              >
                {t('dashboard.saved')}
              </motion.div>
            ) : (
              <motion.div key="save-btn">
                <Button
                  variant="primary"
                  fullWidth
                  size="lg"
                  onClick={handleSave}
                  disabled={!startDate || !endDate || isPending}
                >
                  {isPending ? t('common.loading') : isEdit ? t('dashboard.updateLog') : t('dashboard.savePeriod')}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

'use client'

import { useState, useTransition, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'motion/react'
import { X } from 'lucide-react'
import type { FlowIntensity } from '@vesta/shared/types'
import { Button } from '@/components/ui/Button'
import { createPeriodLog, updatePeriodLog } from '@/app/actions/tracking-actions'
import '@vesta/shared/utils/i18n'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** UI FlowIntensity -> Prisma enum */
function toActionFlow(f: FlowIntensity): 'LIGHT' | 'MEDIUM' | 'HEAVY' {
  return f.toUpperCase() as 'LIGHT' | 'MEDIUM' | 'HEAVY'
}

const FLOW_LABELS: Record<FlowIntensity, string> = {
  light: 'Light',
  medium: 'Medium',
  heavy: 'Heavy',
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
        onSaved()
        setTimeout(onClose, 700)
      } catch (err) {
        console.error('Failed to save period log:', err)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose} onKeyDown={handleKeyDown}>
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? t('dashboard.editPeriodLog') : t('dashboard.logPeriod')}
        className="relative w-full max-w-md max-h-[85dvh] overflow-y-auto overscroll-contain bg-[var(--color-bg-card)] rounded-t-3xl px-5 py-6 shadow-2xl"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--color-border)]" />

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
            {isEdit ? t('dashboard.editPeriodLog') : t('dashboard.logPeriod')}
          </h2>
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
          <input
            id="period-start-date"
            name="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 focus-visible:border-[var(--color-primary)] transition-colors transition-shadow duration-200"
          />
        </div>

        {/* End date */}
        <div className="mb-5">
          <label htmlFor="period-end-date" className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
            {t('dashboard.endDate')}
          </label>
          <input
            id="period-end-date"
            name="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate}
            max={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 focus-visible:border-[var(--color-primary)] transition-colors transition-shadow duration-200"
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
                {FLOW_LABELS[f]}
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

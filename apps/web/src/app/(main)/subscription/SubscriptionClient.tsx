'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import {
  Crown,
  AlertCircle,
  Check,
  X,
  Zap,
  Shield,
  Download,
  MessageSquare,
  BarChart2,
  Star,
  Phone,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useHeld } from '@/lib/use-held'
import type { AuthUser } from '@vesta/shared/server/auth'
import type { SubscriptionStatus } from '@vesta/shared/types'
import { getTrialStatus, getTrialHoursLeft } from '@vesta/shared/utils/trial'
import { getSubscriptionTier } from '@vesta/shared/utils/subscription'
import { updateContactInfo } from '@/app/actions/user-actions'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'

// ── Props ──────────────────────────────────────────────────────────────────────
interface SubscriptionClientProps {
  user: AuthUser
}

// ── Types ──────────────────────────────────────────────────────────────────────
type UpgradeStep = 'idle' | 'phone' | 'confirm' | 'loading' | 'success' | 'error'

// ── Feature rows ───────────────────────────────────────────────────────────────
const COMPARISON_FEATURE_KEYS = [
  { key: 'cycleTracking', labelKey: 'subscription.cycleTracking', free: true, pro: true },
  { key: 'calendar', labelKey: 'subscription.calendarView', free: true, pro: true },
  { key: 'symptoms', labelKey: 'subscription.symptomLogging', free: true, pro: true },
  { key: 'content', labelKey: 'subscription.healthArticles', free: true, pro: true },
  { key: 'smsAlerts', labelKey: 'subscription.smsAlertsShort', free: false, pro: true },
  { key: 'export', labelKey: 'subscription.dataExport', free: false, pro: true },
  { key: 'predictions', labelKey: 'subscription.advancedPredictions', free: false, pro: true },
  { key: 'adFree', labelKey: 'subscription.adFree', free: false, pro: true },
]

const PRO_FEATURE_KEYS = [
  { icon: MessageSquare, labelKey: 'subscription.smsAlertsFull' },
  { icon: BarChart2, labelKey: 'subscription.advancedInsightsFull' },
  { icon: Shield, labelKey: 'subscription.prioritySupportFull' },
  { icon: Download, labelKey: 'subscription.dataExport' },
  { icon: Star, labelKey: 'subscription.adFree' },
]

const FREE_FEATURE_KEYS = [
  'subscription.cycleTracking',
  'subscription.calendarView',
  'subscription.symptomLogging',
  'subscription.healthArticles',
]

// ── BDApps Modal ───────────────────────────────────────────────────────────────
interface BDAppsModalProps {
  open: boolean
  phone: string
  step: UpgradeStep
  onConfirm: () => void
  onCancel: () => void
}

function BDAppsModal({ open, phone, step, onConfirm, onCancel }: BDAppsModalProps) {
  const { t } = useTranslation()
  const statusText =
    step === 'loading'
      ? t('subscription.processing')
      : step === 'success'
        ? `${t('subscription.welcomePro')}. ${t('subscription.upgradedMsg')}`
        : step === 'error'
          ? `${t('subscription.paymentFailed')}. ${t('subscription.paymentFailedMsg')}`
          : ''
  return (
    <Modal
      open={open}
      onClose={onCancel}
      ariaLabel={t('subscription.mobileBilling')}
      titleId="bdapps-modal-title"
      dismissible={step !== 'loading'}
      closeOnBackdrop={step === 'confirm'}
      panelClassName="overflow-hidden"
    >
      {/* Live region covers only the status text, not the whole dialog */}
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {statusText}
      </p>
      {/* Header stripe */}
      <div className="h-1.5 w-full gradient-primary" />
      <div className="p-6">
        {step === 'confirm' && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 pr-10">
              <div className="w-8 h-8 rounded-lg bg-[var(--goal-accent)] flex items-center justify-center">
                <Zap size={16} className="text-[var(--color-on-accent)]" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                  BDApps CAAS
                </p>
                <p className="text-sm font-bold text-[var(--color-text-primary)]">{t('subscription.mobileBilling')}</p>
              </div>
            </div>

            <div className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-4 space-y-2">
              <p className="text-sm text-[var(--color-text-muted)]">{t('subscription.chargeMobile')}</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">৳5</p>
              <p className="text-xs text-[var(--color-text-muted)]">{t('subscription.perDay')}</p>
              <div className="pt-2 border-t border-[var(--color-border)]">
                <p className="text-xs text-[var(--color-text-secondary)]">{t('subscription.billingNumber')}</p>
                <p className="text-sm font-semibold text-[var(--color-text-primary)] font-mono">
                  +{phone}
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--color-text-muted)] text-center leading-relaxed">
              {t('subscription.confirmDeduction')}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={onCancel} fullWidth>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={onConfirm}
                fullWidth
              >
                {t('subscription.confirm')}
              </Button>
            </div>
          </div>
        )}

        {step === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <motion.div
              className="w-14 h-14 rounded-full bg-[var(--goal-accent)] flex items-center justify-center"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Zap size={24} className="text-[var(--color-on-accent)]" />
            </motion.div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              {t('subscription.processing')}
            </p>
          </div>
        )}

        {step === 'success' && (
          <motion.div
            className="flex flex-col items-center gap-4 py-4"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 18, stiffness: 260 }}
          >
            <motion.div
              className="w-16 h-16 rounded-full bg-[var(--goal-accent)] flex items-center justify-center shadow-glow"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', damping: 14 }}
            >
              <Crown size={30} className="text-[var(--color-on-accent)]" />
            </motion.div>
            <div className="text-center space-y-1">
              <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
                {t('subscription.welcomePro')}
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                {t('subscription.upgradedMsg')}
              </p>
            </div>
            <Button
              variant="primary"
              onClick={onCancel}
              fullWidth
            >
              {t('subscription.getStarted')}
            </Button>
          </motion.div>
        )}

        {step === 'error' && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="w-14 h-14 rounded-full bg-[color-mix(in_srgb,var(--color-error)_15%,var(--color-bg-card))] flex items-center justify-center">
              <X size={28} className="text-[var(--color-error)]" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-1">
                {t('subscription.paymentFailed')}
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                {t('subscription.paymentFailedMsg')}
              </p>
            </div>
            <Button variant="outline" onClick={onCancel} fullWidth>
              {t('subscription.close')}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export function SubscriptionClient({ user }: SubscriptionClientProps) {
  const { t } = useTranslation()
  const router = useRouter()

  const [upgradeStep, setUpgradeStep] = useState<UpgradeStep>('idle')
  // Local override so the UI reflects success without a full page reload
  const [localStatus, setLocalStatus] = useState<SubscriptionStatus | null>(null)
  // Phone captured in the 'phone' step (falls back to the user's existing phone)
  const [enteredPhone, setEnteredPhone] = useState(user.phone ?? '')
  const [phoneError, setPhoneError] = useState('')
  const [phonePending, setPhonePending] = useState(false)

  const status: SubscriptionStatus =
    (localStatus ?? (user.subscriptionStatus as SubscriptionStatus)) ?? 'free'

  // Use shared helper for accurate trial status (uses raw DB uppercase enum values)
  // Always use the DB-sourced subscriptionStatus for trial logic (trial helper expects 'FREE'/'PRO')
  const trialStatusUser = {
    authMethod: user.authMethod,
    subscriptionStatus: localStatus ? localStatus.toUpperCase() : user.subscriptionStatus,
    emailTrialExpiresAt: user.emailTrialExpiresAt,
  }
  const trial = getTrialStatus(trialStatusUser)
  const hoursLeft = trial === 'active' ? getTrialHoursLeft(user.emailTrialExpiresAt) : null

  const handleUpgradeClick = () => {
    if (!user.phone && !enteredPhone) {
      setUpgradeStep('phone')
    } else {
      setUpgradeStep('confirm')
    }
  }

  const handlePhoneSubmit = async () => {
    setPhoneError('')
    setPhonePending(true)
    try {
      const res = await updateContactInfo({ phone: enteredPhone })
      if (!res.ok) {
        setPhoneError(res.code === 'PHONE_TAKEN' ? t('subscription.phoneInUse') : t('subscription.phoneAddFailed'))
        return
      }
      // Phone saved — proceed to billing confirmation. Refresh RSC and client
      // completion/logging state so the sidebar reflects the added phone number.
      router.refresh()
      window.dispatchEvent(new Event('vesta:profile-updated'))
      setUpgradeStep('confirm')
    } catch {
      setPhoneError(t('subscription.phoneAddFailed'))
    } finally {
      setPhonePending(false)
    }
  }

  const handleConfirm = async () => {
    setUpgradeStep('loading')
    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 5 }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error?.message ?? `Subscribe request failed (${res.status})`)
      }
      // Upgrade succeeded — refresh RSC and re-fetch auth/trial state so the
      // TrialExpiredLock and TrialCountdownPill clear without a full reload.
      router.refresh()
      window.dispatchEvent(new Event('vesta:profile-updated'))
      setUpgradeStep('success')
    } catch (err) {
      console.error(err)
      setUpgradeStep('error')
    }
  }

  const handleClose = () => {
    if (upgradeStep === 'success') setLocalStatus('pro')
    setUpgradeStep('idle')
    setPhoneError('')
  }

  // Use shared helper: phone (OTP) users are always PRO, LAPSED is distinct from FREE.
  const tier = getSubscriptionTier({ authMethod: user.authMethod, subscriptionStatus: status })
  const isProUser = tier === 'PRO'
  const bdStep = upgradeStep !== 'idle' && upgradeStep !== 'phone' ? upgradeStep : null
  const heldBdStep = useHeld(bdStep)

  return (
    <PageContainer>
      <PageHeader
        title={t('subscription.title')}
        subtitle={t('subscription.unlockTagline')}
      />

      {/* ── Current Plan + Upgrade Cards ── */}
      <div className={`flex flex-col gap-5 ${isProUser ? "" : "lg:grid lg:grid-cols-2"}`}>
        {/* ── Current Plan Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.05 }}
        >
          <div className="surface-wash rounded-3xl border border-[var(--color-border)] shadow-soft p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                  {t('subscription.currentPlan')}
                </p>
                <p className="text-lg font-bold text-[var(--color-text-primary)]">
                  {tier === 'FREE' ? t('subscription.vestaFree') : t('subscription.vestaPro')}
                </p>
                {trial === 'active' && hoursLeft !== null && (
                  <p className="text-xs text-[var(--color-gold-ink)] font-medium">
                    {t('subscription.trialHoursLeft', { hours: hoursLeft })}
                  </p>
                )}
                {trial === 'expired' && (
                  <p className="flex items-center gap-1 text-xs text-[var(--color-error)] font-semibold">
                    <AlertCircle size={12} aria-hidden="true" />
                    {t('subscription.trialExpiredNote')}
                  </p>
                )}
                {tier === 'LAPSED' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                    {t('subscription.planLapsedNote')}
                  </p>
                )}
              </div>

              {tier === 'PRO' ? (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[color-mix(in_srgb,var(--color-accent)_18%,var(--color-bg-card))] text-[var(--color-text-primary)] text-xs font-bold">
                  <Crown size={12} aria-hidden="true" /> <span className="uppercase">{t('subscription.pro')}</span>
                </span>
              ) : tier === 'LAPSED' ? (
                <span className="px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                  {t('subscription.planLapsed')}
                </span>
              ) : (
                <span className="px-3 py-1.5 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-muted)] text-xs font-semibold">
                  <span className="uppercase">{t('subscription.free')}</span>
                </span>
              )}
            </div>

            <div className="mt-4 space-y-1.5">
              {isProUser ? (
                PRO_FEATURE_KEYS.map(({ icon: Icon, labelKey }) => (
                  <div
                    key={labelKey}
                    className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]"
                  >
                    <Check size={14} className="text-[var(--goal-accent)] shrink-0" />
                    {t(labelKey)}
                  </div>
                ))
              ) : (
                FREE_FEATURE_KEYS.map(key => (
                  <div
                    key={key}
                    className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]"
                  >
                    <Check size={14} className="text-[var(--color-text-muted)] shrink-0" />
                    {t(key)}
                  </div>
                ))
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Pro Plan Upgrade Card ── */}
        {!isProUser && (
          <motion.div
            className="order-first md:order-none"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="relative rounded-3xl overflow-hidden shadow-soft h-full surface-wash border border-[color-mix(in_srgb,var(--color-accent)_45%,var(--color-border))]">
              <div className="relative p-6 space-y-5">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[color-mix(in_srgb,var(--color-accent)_18%,var(--color-bg-card))] text-[var(--color-text-primary)] text-xs font-bold">
                    <Crown size={12} aria-hidden="true" /> <span className="uppercase">{t('subscription.pro')}</span>
                  </span>
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{t('subscription.title')}</h2>
                </div>

                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-extrabold text-[var(--color-text-primary)]">৳5</span>
                    <span className="text-[var(--color-text-secondary)] text-sm">/{t('subscription.dayUnit')}</span>
                  </div>
                  <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
                    {t('subscription.billedViaBDApps')}
                  </p>
                </div>

                <div className="space-y-2">
                  {PRO_FEATURE_KEYS.map(({ icon: Icon, labelKey }) => (
                    <div
                      key={labelKey}
                      className="flex items-center gap-2.5 text-[var(--color-text-secondary)] text-sm"
                    >
                      <div className="w-5 h-5 rounded-full bg-[var(--color-accent)]/25 flex items-center justify-center shrink-0">
                        <Check size={12} className="text-[var(--color-gold-ink)]" aria-hidden="true" />
                      </div>
                      {t(labelKey)}
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleUpgradeClick}
                  className={`w-full bg-[var(--color-action)] text-[var(--color-on-action)] font-bold rounded-full text-base hover:opacity-90 active:scale-[0.98] transition-colors duration-200 shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-action)] ${
                    trial === 'expired' ? 'py-4 text-lg animate-pulse' : 'py-3.5'
                  }`}
                >
                  {t('subscription.upgradeButton')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Comparison Table ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, delay: 0.15 }}
      >
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-3">
          {t('subscription.freeVsPro')}
        </h2>

        <div className="rounded-3xl overflow-hidden bg-[var(--color-bg-card)] shadow-soft divide-y divide-[var(--color-border)]">
          <div className="grid grid-cols-3 surface-peach">
            <div className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide col-span-1">
              {t('subscription.featureHeader')}
            </div>
            <div className="px-2 py-3 text-center">
              <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                {t('subscription.free')}
              </span>
            </div>
            <div className="px-2 py-3 text-center">
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--color-accent)_18%,var(--color-bg-card))] text-[var(--color-text-primary)]">
                <Crown size={10} aria-hidden="true" /> {t('subscription.pro')}
              </span>
            </div>
          </div>

          {COMPARISON_FEATURE_KEYS.map(({ key, labelKey, free, pro }) => (
            <div
              key={key}
              className="grid grid-cols-3"
            >
              <div className="px-4 py-3 text-sm md:text-base text-[var(--color-text-secondary)] col-span-1">
                {t(labelKey)}
              </div>
              <div className="px-2 py-3 flex justify-center items-center">
                {free ? (
                  <Check size={16} className="text-[var(--color-text-muted)]" aria-hidden="true" />
                ) : (
                  <X size={16} className="text-[var(--color-border)]" aria-hidden="true" />
                )}
              </div>
              <div className="px-2 py-3 flex justify-center items-center">
                {pro ? (
                  <Check size={16} strokeWidth={2.5} className="text-[var(--color-primary)]" aria-hidden="true" />
                ) : (
                  <X size={16} className="text-[var(--color-border)]" aria-hidden="true" />
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Footer note ── */}
      {!isProUser && (
        <p className="text-center text-xs text-[var(--color-text-muted)] pb-2">
          {t('subscription.cancelAnytime')}
        </p>
      )}

      {/* ── Phone-entry step (email-auth users with no phone) ── */}
      {/* Always mounted so the shell can play the exit animation */}
      <Modal
          open={upgradeStep === 'phone'}
          onClose={handleClose}
          titleId="phone-step-title"
          panelClassName="overflow-hidden"
        >
      {/* Header stripe */}
      <div className="h-1.5 w-full gradient-primary" />

      <div className="p-6 space-y-5">
        <div className="flex items-center gap-2 pr-10">
          <div className="w-8 h-8 rounded-lg bg-[var(--goal-accent)] flex items-center justify-center">
            <Phone size={16} className="text-[var(--color-on-accent)]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              BDApps CAAS
            </p>
            <p id="phone-step-title" className="text-sm font-bold text-[var(--color-text-primary)]">
              {t('subscription.addPhoneTitle')}
            </p>
          </div>
        </div>

        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
          {t('subscription.addPhoneBody')}
        </p>

        <div className="space-y-1.5">
          <label
            htmlFor="subscription-phone-input"
            className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide"
          >
            {t('auth.phone')}
          </label>
          <input
            id="subscription-phone-input"
                data-autofocus
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            spellCheck={false}
            placeholder={t('subscription.addPhonePlaceholder')}
            value={enteredPhone}
            onChange={(e) => {
              setEnteredPhone(e.target.value)
              if (phoneError) setPhoneError('')
            }}
            disabled={phonePending}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)] focus-visible:ring-offset-1 disabled:opacity-50 transition-colors duration-200 font-mono"
          />
          {phoneError && (
            <p role="alert" aria-live="polite" className="text-xs text-[var(--color-error)] pt-0.5">
              {phoneError}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={handleClose} fullWidth disabled={phonePending}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handlePhoneSubmit}
            fullWidth
            disabled={phonePending || !enteredPhone.trim()}
          >
            {phonePending ? t('common.saving') : t('subscription.addPhoneCta')}
          </Button>
        </div>
      </div>
        </Modal>

      {/* ── BDApps Modal (held through the exit animation) ── */}
      {heldBdStep && (
        <BDAppsModal
          open={bdStep !== null}
          phone={enteredPhone || (user.phone ?? '')}
          step={heldBdStep}
          onConfirm={handleConfirm}
          onCancel={handleClose}
        />
      )}
    </PageContainer>
  )
}

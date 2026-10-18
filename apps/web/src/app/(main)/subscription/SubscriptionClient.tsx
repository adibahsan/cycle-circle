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
  Shield,
  Download,
  MessageSquare,
  BarChart2,
  Star,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { AddPhoneDialog } from '@/components/AddPhoneDialog'
import type { AuthUser } from '@vesta/shared/server/auth'
import type { SubscriptionStatus } from '@vesta/shared/types'
import { getTrialStatus, getTrialHoursLeft } from '@vesta/shared/utils/trial'
import { getSubscriptionTier } from '@vesta/shared/utils/subscription'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'

// ── Props ──────────────────────────────────────────────────────────────────────
interface SubscriptionClientProps {
  user: AuthUser
}

const toLocalStatus = (status: string) => status.toLowerCase() as SubscriptionStatus

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

// ── Page ───────────────────────────────────────────────────────────────────────
export function SubscriptionClient({ user }: SubscriptionClientProps) {
  const { t } = useTranslation()
  const router = useRouter()

  // Local override so the UI reflects success without a full page reload
  const [localStatus, setLocalStatus] = useState<SubscriptionStatus | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [unsubPending, setUnsubPending] = useState(false)
  const [addPhoneOpen, setAddPhoneOpen] = useState(false)
  const [unsubResult, setUnsubResult] = useState<'success' | 'error' | 'adminOverride' | 'noPhone' | null>(null)

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

  // Phone verification through BDApps OTP is the subscription (ADR 0002), so the
  // CTA opens the add-phone dialog in place instead of CaaS billing or /login
  // (which would create a separate phone account for a logged-in email user).
  const handlePhoneVerified = (newStatus: string | undefined) => {
    setLocalStatus(toLocalStatus(newStatus ?? 'PRO'))
    router.refresh()
    window.dispatchEvent(new Event('vesta:profile-updated'))
  }

  const closeConfirm = () => {
    if (!unsubPending) setConfirmOpen(false)
  }

  const handleUnsubscribe = async () => {
    setUnsubPending(true)
    try {
      const res = await fetch('/api/billing/unsubscribe', { method: 'POST' })
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as { error?: { code?: string } } | null
        const code = errBody?.error?.code
        setUnsubResult(code === 'ADMIN_OVERRIDE' ? 'adminOverride' : code === 'NO_PHONE' ? 'noPhone' : 'error')
        return
      }
      const body = (await res.json().catch(() => null)) as { status?: string } | null
      setLocalStatus(toLocalStatus(body?.status ?? 'FREE'))
      setUnsubResult('success')
      router.refresh()
      window.dispatchEvent(new Event('vesta:profile-updated'))
    } catch (err) {
      console.error(err)
      setUnsubResult('error')
    } finally {
      setUnsubPending(false)
      setConfirmOpen(false)
    }
  }

  // Use shared helper: LAPSED is distinct from FREE.
  const tier = getSubscriptionTier({ authMethod: user.authMethod, subscriptionStatus: status })
  const isProUser = tier === 'PRO'
  const canUnsubscribe = isProUser && Boolean(user.phone)

  return (
    <PageContainer width="canvas">
      <PageHeader
        title={isProUser ? t('subscription.titlePro') : t('subscription.title')}
        subtitle={isProUser ? t('subscription.subtitlePro') : t('subscription.unlockTagline')}
      />

      {/* From 2xl the plans and the Free vs Pro table sit side by side. */}
      <div className={`flex flex-col gap-5 2xl:grid 2xl:items-start 2xl:gap-6 ${isProUser ? '2xl:grid-cols-2' : '2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'}`}>
        {/* ── Current Plan + Upgrade Cards ── */}
        <div className={`flex flex-col gap-5 ${isProUser ? "" : "lg:grid lg:grid-cols-2"}`}>
          {/* ── Current Plan Card ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: 0.05 }}
          >
            <Card tone="panel" padding="lg" className="h-full">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[var(--color-text-muted)]">
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
                    <p className="text-xs text-[var(--color-gold-ink)] font-semibold">
                      {t('subscription.planLapsedNote')}
                    </p>
                  )}
                </div>

                {tier === 'PRO' ? (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-tint-peach text-accent-peach text-xs font-bold">
                    <Crown size={12} aria-hidden="true" /> <span className="uppercase">{t('subscription.pro')}</span>
                  </span>
                ) : tier === 'LAPSED' ? (
                  <span className="px-3 py-1.5 rounded-full bg-tint-peach text-accent-peach text-xs font-semibold">
                    {t('subscription.planLapsed')}
                  </span>
                ) : (
                  <span className="px-3 py-1.5 rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] text-xs font-semibold">
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
                      <Check aria-hidden="true" size={14} className="text-accent-mint shrink-0" />
                      {t(labelKey)}
                    </div>
                  ))
                ) : (
                  FREE_FEATURE_KEYS.map(key => (
                    <div
                      key={key}
                      className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]"
                    >
                      <Check aria-hidden="true" size={14} className="text-[var(--color-text-muted)] shrink-0" />
                      {t(key)}
                    </div>
                  ))
                )}
              </div>

              {canUnsubscribe && (
                <div className="mt-5">
                  <Button variant="outline" fullWidth onClick={() => { setUnsubResult(null); setConfirmOpen(true) }}>
                    {t('subscription.unsubscribeButton')}
                  </Button>
                </div>
              )}
              <div aria-live="polite" aria-atomic="true">
                {unsubResult && (
                  <p
                    className={`mt-3 text-sm font-medium ${unsubResult === 'success' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-error)]'}`}
                  >
                    {unsubResult === 'success'
                      ? t('subscription.unsubscribeSuccess')
                      : unsubResult === 'adminOverride'
                      ? t('subscription.unsubscribeAdminOverride')
                      : unsubResult === 'noPhone'
                      ? t('subscription.unsubscribeNoPhone')
                      : t('subscription.unsubscribeError')}
                  </p>
                )}
              </div>
            </Card>
          </motion.div>

          {/* ── Pro Plan Upgrade Card ── */}
          {!isProUser && (
            <motion.div
              className="order-first md:order-none"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <Card tone="peach" padding="lg" className="h-full">
                <div className="space-y-5">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--color-bg-card)] text-accent-peach text-xs font-bold">
                      <Crown size={12} aria-hidden="true" /> <span className="uppercase">{t('subscription.pro')}</span>
                    </span>
                    <h2 className="text-xl font-bold text-accent-peach">{t('subscription.title')}</h2>
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
                        <div className="w-5 h-5 rounded-full bg-[var(--color-bg-card)] flex items-center justify-center shrink-0">
                          <Check size={12} className="text-accent-peach" aria-hidden="true" />
                        </div>
                        {t(labelKey)}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setAddPhoneOpen(true)}
                    className={`w-full bg-[var(--color-action)] text-[var(--color-on-action)] font-bold rounded-full text-base hover:opacity-90 active:scale-[0.98] transition-colors duration-200 shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-action)] ${
                      trial === 'expired' ? 'py-4 text-lg' : 'py-3.5'
                    }`}
                  >
                    {t('subscription.upgradeButton')}
                  </button>
                </div>
              </Card>
            </motion.div>
          )}
        </div>

        {/* ── Comparison Table ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.15 }}
        >
          <SectionHeader title={t('subscription.freeVsPro')} />

          <Card tone="panel" className="p-0 overflow-hidden divide-y divide-[var(--color-border)]">
            <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem] sm:grid-cols-3 bg-tint-peach">
              <div className="px-4 sm:px-5 py-3 text-xs font-semibold text-[var(--color-text-secondary)] col-span-1">
                {t('subscription.featureHeader')}
              </div>
              <div className="px-1 sm:px-2 py-3 text-center">
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                  {t('subscription.free')}
                </span>
              </div>
              <div className="px-1 sm:px-2 py-3 text-center">
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-[var(--color-bg-card)] text-accent-peach">
                  <Crown size={10} aria-hidden="true" /> {t('subscription.pro')}
                </span>
              </div>
            </div>

            {COMPARISON_FEATURE_KEYS.map(({ key, labelKey, free, pro }) => (
              <div
                key={key}
                className="grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem] sm:grid-cols-3"
              >
                <div className="px-4 sm:px-5 py-3 text-sm md:text-base text-[var(--color-text-secondary)] col-span-1">
                  {t(labelKey)}
                </div>
                <div className="px-1 sm:px-2 py-3 flex justify-center items-center">
                  {free ? (
                    <Check size={16} className="text-[var(--color-text-muted)]" aria-hidden="true" />
                  ) : (
                    <X size={16} className="text-[var(--color-border)]" aria-hidden="true" />
                  )}
                </div>
                <div className="px-1 sm:px-2 py-3 flex justify-center items-center">
                  {pro ? (
                    <Check size={16} strokeWidth={2.5} className="text-accent-mint" aria-hidden="true" />
                  ) : (
                    <X size={16} className="text-[var(--color-border)]" aria-hidden="true" />
                  )}
                </div>
              </div>
            ))}
          </Card>
        </motion.div>
      </div>

      {/* ── Footer note ── */}
      {!isProUser && (
        <p className="text-center text-xs text-[var(--color-text-muted)] pb-2">
          {t('subscription.cancelAnytime')}
        </p>
      )}

      <AddPhoneDialog
        open={addPhoneOpen}
        onClose={() => setAddPhoneOpen(false)}
        onVerified={handlePhoneVerified}
        initialPhone={user.phone}
        purpose="upgrade"
      />

      {/* ── Unsubscribe confirm (Pro users with a phone) ── */}
      <Modal
        open={confirmOpen}
        onClose={closeConfirm}
        titleId="unsubscribe-title"
        descId="unsubscribe-desc"
        dismissible={!unsubPending}
        panelClassName="overflow-hidden"
      >
        <div className="h-1.5 w-full gradient-primary" />
        <div className="p-6 space-y-5">
          <h2 id="unsubscribe-title" className="text-lg font-bold text-[var(--color-text-primary)] pr-10">
            {t('subscription.unsubscribeConfirmTitle')}
          </h2>
          <p id="unsubscribe-desc" className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            {t('subscription.unsubscribeConfirmBody')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="primary" onClick={closeConfirm} fullWidth disabled={unsubPending} data-autofocus>
              {t('subscription.unsubscribeCancel')}
            </Button>
            <Button variant="outline" onClick={handleUnsubscribe} fullWidth disabled={unsubPending}>
              {t('subscription.unsubscribeConfirm')}
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  )
}

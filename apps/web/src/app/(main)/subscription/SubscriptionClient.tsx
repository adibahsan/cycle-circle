'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'motion/react'
import {
  Crown,
  Check,
  X,
  Zap,
  Shield,
  Download,
  MessageSquare,
  BarChart2,
  Star,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { AuthUser } from '@vesta/shared/server/auth'
import type { SubscriptionStatus } from '@vesta/shared/types'

// ── Props ──────────────────────────────────────────────────────────────────────
interface SubscriptionClientProps {
  user: AuthUser
}

// ── Types ──────────────────────────────────────────────────────────────────────
type UpgradeStep = 'idle' | 'confirm' | 'loading' | 'success' | 'error'

// ── Feature rows ───────────────────────────────────────────────────────────────
const COMPARISON_FEATURES = [
  { key: 'cycleTracking', label: 'Cycle Tracking', free: true, pro: true },
  { key: 'calendar', label: 'Calendar View', free: true, pro: true },
  { key: 'symptoms', label: 'Symptom Logging', free: true, pro: true },
  { key: 'content', label: 'Health Articles', free: true, pro: true },
  { key: 'smsAlerts', label: 'SMS Alerts', free: false, pro: true },
  { key: 'export', label: 'Data Export', free: false, pro: true },
  { key: 'predictions', label: 'Advanced Predictions', free: false, pro: true },
  { key: 'adFree', label: 'Ad-free Experience', free: false, pro: true },
]

const PRO_FEATURES = [
  { icon: MessageSquare, label: 'SMS Period & Fertile Alerts' },
  { icon: BarChart2, label: 'Advanced Cycle Insights' },
  { icon: Shield, label: 'Priority Support' },
  { icon: Download, label: 'Data Export' },
  { icon: Star, label: 'Ad-free Experience' },
]

// ── Trial countdown helper ─────────────────────────────────────────────────────
function useTrialCountdown(expiresAt?: Date | null) {
  const [hoursLeft, setHoursLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!expiresAt) return
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now()
      setHoursLeft(Math.max(0, Math.floor(diff / 3_600_000)))
    }
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [expiresAt])

  return hoursLeft
}

// ── BDApps Modal ───────────────────────────────────────────────────────────────
interface BDAppsModalProps {
  phone: string
  step: UpgradeStep
  onConfirm: () => void
  onCancel: () => void
}

function BDAppsModal({ phone, step, onConfirm, onCancel }: BDAppsModalProps) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end md:items-center justify-center px-4 pb-6 md:pb-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={step === 'confirm' ? onCancel : undefined}
        />

        <motion.div
          className="relative w-full max-w-md rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden shadow-glow"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 280 }}
        >
          {/* Header stripe */}
          <div className="h-1.5 w-full gradient-primary" />

          <div className="p-6">
            {step === 'confirm' && (
              <div className="space-y-5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                    <Zap size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                      BDApps CAAS
                    </p>
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">Mobile Billing</p>
                  </div>
                </div>

                <div className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-4 space-y-2">
                  <p className="text-sm text-[var(--color-text-muted)]">Charge to mobile balance</p>
                  <p className="text-2xl font-bold text-[var(--color-text-primary)]">৳99</p>
                  <p className="text-xs text-[var(--color-text-muted)]">per month · Vesta Pro</p>
                  <div className="pt-2 border-t border-[var(--color-border)]">
                    <p className="text-xs text-[var(--color-text-secondary)]">Billing number</p>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] font-mono">
                      +{phone}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-[var(--color-text-muted)] text-center leading-relaxed">
                  By confirming, ৳99 will be deducted from your mobile balance each month. Cancel
                  anytime.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={onCancel} fullWidth>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={onConfirm}
                    fullWidth
                    className="gradient-primary border-0"
                  >
                    Confirm
                  </Button>
                </div>
              </div>
            )}

            {step === 'loading' && (
              <div className="flex flex-col items-center gap-4 py-6">
                <motion.div
                  className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Zap size={24} className="text-white" />
                </motion.div>
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                  Processing payment…
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
                  className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center shadow-glow"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring', damping: 14 }}
                >
                  <Crown size={30} className="text-white" />
                </motion.div>
                <div className="text-center space-y-1">
                  <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
                    Welcome to Pro!
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Your account has been upgraded. Enjoy all Pro features.
                  </p>
                </div>
                <Button
                  variant="primary"
                  onClick={onCancel}
                  fullWidth
                  className="gradient-primary border-0"
                >
                  Get Started
                </Button>
              </motion.div>
            )}

            {step === 'error' && (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                  <X size={28} className="text-red-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-1">
                    Payment Failed
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Something went wrong. Please try again later.
                  </p>
                </div>
                <Button variant="outline" onClick={onCancel} fullWidth>
                  Close
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export function SubscriptionClient({ user }: SubscriptionClientProps) {
  const { t } = useTranslation()

  const [upgradeStep, setUpgradeStep] = useState<UpgradeStep>('idle')
  // Local override so the UI reflects success without a full page reload
  const [localStatus, setLocalStatus] = useState<SubscriptionStatus | null>(null)

  const status: SubscriptionStatus =
    (localStatus ?? (user.subscriptionStatus as SubscriptionStatus)) ?? 'free'

  const hoursLeft = useTrialCountdown(
    status === 'free' && user.authMethod === 'email' ? user.emailTrialExpiresAt : null,
  )

  const handleUpgradeClick = () => setUpgradeStep('confirm')

  const handleConfirm = async () => {
    setUpgradeStep('loading')
    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 99 }),
      })
      if (!res.ok) throw new Error('Subscribe request failed')
      setUpgradeStep('success')
    } catch (err) {
      console.error(err)
      setUpgradeStep('error')
    }
  }

  const handleClose = () => {
    if (upgradeStep === 'success') setLocalStatus('pro')
    setUpgradeStep('idle')
  }

  const isPro = status === 'pro'

  return (
    <div className="py-4 space-y-6">
      {/* ── Page title ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)]">
          {t('subscription.title')}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
          Unlock the full power of Vesta
        </p>
      </motion.div>

      {/* ── Current Plan + Upgrade Cards ── */}
      <div className="md:grid md:grid-cols-2 md:gap-6 space-y-6 md:space-y-0">
        {/* ── Current Plan Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.05 }}
        >
          <Card padding="md">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                  {t('subscription.currentPlan')}
                </p>
                <p className="text-lg font-bold text-[var(--color-text-primary)]">
                  {isPro ? 'Vesta Pro' : 'Vesta Free'}
                </p>
                {hoursLeft !== null && !isPro && (
                  <p className="text-xs text-[var(--color-accent)] font-medium">
                    Trial · {hoursLeft}h remaining
                  </p>
                )}
              </div>

              {isPro ? (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full gradient-primary text-white text-xs font-bold shadow-soft">
                  <Crown size={12} /> PRO
                </span>
              ) : (
                <span className="px-3 py-1.5 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-muted)] text-xs font-semibold">
                  FREE
                </span>
              )}
            </div>

            <div className="mt-4 space-y-1.5">
              {isPro ? (
                PRO_FEATURES.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]"
                  >
                    <Check size={14} className="text-[var(--color-primary)] shrink-0" />
                    {label}
                  </div>
                ))
              ) : (
                ['Cycle Tracking', 'Calendar', 'Symptom Logging', 'Health Articles'].map(f => (
                  <div
                    key={f}
                    className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]"
                  >
                    <Check size={14} className="text-[var(--color-text-muted)] shrink-0" />
                    {f}
                  </div>
                ))
              )}
            </div>
          </Card>
        </motion.div>

        {/* ── Pro Plan Upgrade Card ── */}
        {!isPro && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="relative rounded-2xl overflow-hidden shadow-glow h-full">
              <div className="absolute inset-0 gradient-primary opacity-90" />
              <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-black/10 blur-2xl" />

              <div className="relative p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <Crown size={24} className="text-white" />
                  <h2 className="text-xl font-bold text-white">Go Pro</h2>
                </div>

                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-extrabold text-white">৳99</span>
                    <span className="text-white/70 text-sm">/month</span>
                  </div>
                  <p className="text-white/60 text-xs mt-0.5">
                    Charged to your mobile balance via BDApps
                  </p>
                </div>

                <div className="space-y-2">
                  {PRO_FEATURES.map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="flex items-center gap-2.5 text-white/90 text-sm"
                    >
                      <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                        <Check size={12} className="text-white" />
                      </div>
                      {label}
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleUpgradeClick}
                  className="w-full bg-white text-[var(--color-primary)] font-bold py-3.5 rounded-xl text-base hover:bg-white/90 active:scale-[0.98] transition-all duration-200 shadow-soft"
                >
                  Upgrade to Pro
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
          Free vs Pro
        </h2>

        <div className="rounded-2xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg-card)]">
          <div className="grid grid-cols-3 bg-[var(--color-bg-secondary)]">
            <div className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide col-span-1">
              Feature
            </div>
            <div className="px-2 py-3 text-center">
              <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                Free
              </span>
            </div>
            <div className="px-2 py-3 text-center">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-white px-2.5 py-0.5 rounded-full gradient-primary">
                <Crown size={10} /> Pro
              </span>
            </div>
          </div>

          {COMPARISON_FEATURES.map(({ key, label, free, pro }, i) => (
            <div
              key={key}
              className={`grid grid-cols-3 border-t border-[var(--color-border)] ${
                i % 2 === 0 ? '' : 'bg-[var(--color-bg-secondary)]/40'
              }`}
            >
              <div className="px-4 py-3 text-sm md:text-base text-[var(--color-text-secondary)] col-span-1">
                {label}
              </div>
              <div className="px-2 py-3 flex justify-center items-center">
                {free ? (
                  <Check size={16} className="text-[var(--color-text-muted)]" />
                ) : (
                  <X size={16} className="text-[var(--color-border)]" />
                )}
              </div>
              <div className="px-2 py-3 flex justify-center items-center">
                {pro ? (
                  <Check size={16} className="text-[var(--color-primary)]" />
                ) : (
                  <X size={16} className="text-[var(--color-border)]" />
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Footer note ── */}
      {!isPro && (
        <p className="text-center text-xs text-[var(--color-text-muted)] pb-2">
          Cancel anytime. No hidden fees.
        </p>
      )}

      {/* ── BDApps Modal ── */}
      {upgradeStep !== 'idle' && (
        <BDAppsModal
          phone={user.phone ?? ''}
          step={upgradeStep}
          onConfirm={handleConfirm}
          onCancel={handleClose}
        />
      )}
    </div>
  )
}

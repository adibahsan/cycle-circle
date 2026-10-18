'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { useToast } from '@/components/ui/Toast'
import {
  Globe,
  Moon,
  Sun,
  Bell,
  Download,
  User,
  LogOut,
  ChevronRight,
  Users,
  MessageSquare,
  Crown,
  FileSpreadsheet,
  FileText,
  Lock,
  Info,
  Mail,
  Phone,
  Compass,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useLanguage } from '@/lib/use-language'
import { Button } from '@/components/ui/Button'
import { Card, type CardTint } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { updateNotificationPrefs, exportUserDataCsv, exportUserDataRows, updateProfileReminderOptOut } from '@/app/actions/settings-actions'
import { updateContactInfo } from '@/app/actions/user-actions'
import type { AuthUser } from '@vesta/shared/server/auth'
import type { Language, Theme } from '@vesta/shared/types'
import { isPro as isProHelper, getSubscriptionTier } from '@vesta/shared/utils/subscription'
import { LogoutConfirmModal } from '@/components/LogoutConfirmModal'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'

// ── DB types ───────────────────────────────────────────────────────────────────
interface DbProfile {
  id: string
  userId: string
  name: string
  relation: string
  cycleLength: number
  periodLength: number
  lastPeriodStart: Date | null
  goal: string | null
  createdAt: Date
  updatedAt: Date
}

interface DbNotifPref {
  id: string
  profileId: string
  periodAlert: boolean
  fertileWindow: boolean
  loggingReminder: boolean
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface SettingsClientProps {
  user: AuthUser
  profiles: DbProfile[]
  notifPrefs: DbNotifPref[]
  completionRemindersOptOut: boolean
}

// ── Primitive components ───────────────────────────────────────────────────────

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: React.ReactNode; value: T }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" className="flex items-center gap-0.5 p-1 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`relative flex-1 min-h-11 py-2 px-4 rounded-full text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)] ${
              active
                ? 'text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${options.map(o => o.value).join('-')}`}
                className="absolute inset-0 rounded-full bg-[var(--color-bg-card)] shadow-soft"
                transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  id,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  id: string
  label?: string
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label ?? id}
      onClick={() => onChange(!checked)}
      className="group inline-flex h-11 w-14 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]"
    >
      {/* 44px tap area around the 24px visual track */}
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
          checked ? 'gradient-primary' : 'bg-[var(--color-border-strong)]'
        }`}
      >
        <motion.span
          layout
          transition={{ type: 'spring', damping: 22, stiffness: 400 }}
          className="inline-block rounded-full bg-[var(--color-bg-card)] shadow-soft"
          style={{ width: 18, height: 18, translateX: checked ? 20 : 4 }}
        />
      </span>
    </button>
  )
}

// Full literal class strings so Tailwind can see them.
const TINT_BADGE: Record<CardTint, string> = {
  peach: 'bg-tint-peach text-accent-peach',
  pink: 'bg-tint-pink text-accent-pink',
  mint: 'bg-tint-mint text-accent-mint',
  lavender: 'bg-tint-lavender text-accent-lavender',
  sky: 'bg-tint-sky text-accent-sky',
  sage: 'bg-tint-sage text-accent-sage',
}

/** Badge tint per settings section (kept out of JSX attributes so label scans stay clean). */
const SECTION_TINT = {
  appearance: 'sky',
  notifications: 'pink',
  export: 'mint',
  account: 'lavender',
  about: 'sage',
} as const satisfies Record<string, CardTint>

/** Section title with a drawn icon on a pastel tint, for the shared SectionHeader. */
function SectionTitle({ icon: Icon, tint, children }: { icon: React.ElementType; tint: CardTint; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden="true" className={`w-8 h-8 rounded-full ${TINT_BADGE[tint]} flex items-center justify-center shrink-0`}>
        <Icon size={15} />
      </span>
      {children}
    </span>
  )
}

function AccountRow({
  icon: Icon,
  label,
  href,
  badge,
}: {
  icon: React.ElementType
  label: string
  href: string
  badge?: string
}) {
  return (
    <Link href={href} className="flex items-center gap-3 py-3 px-1 min-h-11 rounded-sm group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]">
      <Icon
        size={17}
        aria-hidden="true"
        className="text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] transition-colors shrink-0"
      />
      <span className="flex-1 text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">
        {label}
      </span>
      {badge && (
        <span className="flex items-center gap-1 text-xs font-bold text-accent-peach px-2.5 py-0.5 rounded-full bg-tint-peach">
          {badge}
        </span>
      )}
      <ChevronRight aria-hidden="true"
        size={15}
        className="text-[var(--color-border)] group-hover:text-[var(--color-text-muted)] transition-colors"
      />
    </Link>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export function SettingsClient({ user, profiles, notifPrefs, completionRemindersOptOut }: SettingsClientProps) {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const language = useLanguage()
  const setLanguage = useAppStore((s) => s.setLanguage)
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const activeProfileId = useAppStore((s) => s.activeProfileId)
  const setActiveProfile = useAppStore((s) => s.setActiveProfile)

  const { show: showToast } = useToast()

  // Find the active profile's notification prefs, defaulting to all-on
  const activeProfile = profiles.find(p => p.id === activeProfileId) ?? profiles[0]
  const activePrefs = notifPrefs.find(p => p.profileId === activeProfile?.id)

  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    if (activeProfile && !loggingOut) {
      setActiveProfile(activeProfile.id, activeProfile.name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile?.id, activeProfile?.name, setActiveProfile])

  const [localPrefs, setLocalPrefs] = useState({
    periodAlert: activePrefs?.periodAlert ?? true,
    fertileWindow: activePrefs?.fertileWindow ?? true,
    loggingReminder: activePrefs?.loggingReminder ?? true,
  })

  const [exportAll, setExportAll] = useState(false)
  const [addingEmail, setAddingEmail] = useState(false)
  const [addingPhone, setAddingPhone] = useState(false)
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactSaving, setContactSaving] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [exporting, setExporting] = useState(false)
  const exportingRef = useRef(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  // ── Language handler ──
  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  // ── Theme handler — Providers.tsx manages DOM class, just update store ──
  const handleThemeChange = (t: Theme) => {
    setTheme(t)
  }

  // ── Notification pref handler ──
  const savedPrefsRef = useRef(localPrefs)
  const pendingPrefsRef = useRef(localPrefs)
  const notifDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleNotifChange = (
    key: 'periodAlert' | 'fertileWindow' | 'loggingReminder',
    value: boolean,
  ) => {
    if (!activeProfile) return
    const updated = { ...localPrefs, [key]: value }
    setLocalPrefs(updated)
    pendingPrefsRef.current = updated

    if (notifDebounceRef.current) clearTimeout(notifDebounceRef.current)
    notifDebounceRef.current = setTimeout(async () => {
      const toSave = pendingPrefsRef.current
      try {
        await updateNotificationPrefs({
          profileId: activeProfile.id,
          periodAlert: toSave.periodAlert,
          fertileWindow: toSave.fertileWindow,
          loggingReminder: toSave.loggingReminder,
        })
        savedPrefsRef.current = toSave
        showToast(t('settings.prefsSaved'))
      } catch {
        setLocalPrefs(savedPrefsRef.current)
        showToast(t('settings.prefsFailed'))
      }
    }, 600)
  }

  // ── Completion reminder opt-out toggle ──
  const [remindersEnabled, setRemindersEnabled] = useState(!completionRemindersOptOut)
  const savedRemindersRef = useRef(!completionRemindersOptOut)

  const handleRemindersChange = async (enabled: boolean) => {
    setRemindersEnabled(enabled)
    try {
      await updateProfileReminderOptOut(!enabled)
      savedRemindersRef.current = enabled
      showToast(t('settings.prefsSaved'))
    } catch {
      setRemindersEnabled(savedRemindersRef.current)
      showToast(t('settings.prefsFailed'))
    }
  }

  // ── Contact info handlers ──
  const handleAddEmail = async () => {
    if (!contactEmail) return
    setContactSaving(true)
    setEmailError('')
    try {
      const res = await updateContactInfo({ email: contactEmail })
      if (res.ok) {
        showToast(t('settings.emailAdded'))
        setAddingEmail(false)
        setContactEmail('')
        setEmailError('')
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vesta:profile-updated'))
        router.refresh()
      } else {
        setEmailError(res.code === 'EMAIL_TAKEN' ? t('settings.emailInUse') : t('settings.emailAddFailed'))
      }
    } catch {
      setEmailError(t('settings.emailAddFailed'))
    } finally {
      setContactSaving(false)
    }
  }

  const handleAddPhone = async () => {
    if (!contactPhone) return
    setContactSaving(true)
    setPhoneError('')
    try {
      const res = await updateContactInfo({ phone: contactPhone })
      if (res.ok) {
        showToast(t('settings.phoneAdded'))
        setAddingPhone(false)
        setContactPhone('')
        setPhoneError('')
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vesta:profile-updated'))
        router.refresh()
      } else {
        setPhoneError(res.code === 'PHONE_TAKEN' ? t('settings.phoneInUse') : t('settings.phoneAddFailed'))
      }
    } catch {
      setPhoneError(t('settings.phoneAddFailed'))
    } finally {
      setContactSaving(false)
    }
  }

  // ── Export handlers ──
  const triggerDownload = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleExportCsv = async () => {
    if (exportingRef.current) return
    exportingRef.current = true
    setExporting(true)
    showToast(t('settings.csvPreparing'))
    try {
      const { csv, filename } = await exportUserDataCsv({ profileId: activeProfile?.id, allProfiles: exportAll })
      triggerDownload(csv, filename)
      showToast(t('settings.csvDownloaded'))
    } catch {
      showToast(t('settings.exportFailed'))
    } finally {
      exportingRef.current = false
      setExporting(false)
    }
  }

  const handleExportExcel = async () => {
    if (exportingRef.current) return
    exportingRef.current = true
    setExporting(true)
    showToast(t('settings.exportPreparing'))
    try {
      // Lazy-load SheetJS (~400KB+) only when the user actually exports, so it
      // stays out of the Settings route's first-load bundle.
      const XLSX = await import('xlsx')
      const { periodLogs, symptomLogs, filename } = await exportUserDataRows({ profileId: activeProfile?.id, allProfiles: exportAll })
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(periodLogs), 'Period Logs')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(symptomLogs), 'Symptom Logs')
      XLSX.writeFile(wb, filename)
      showToast(t('settings.exportDone'))
    } catch {
      showToast(t('settings.exportFailed'))
    } finally {
      exportingRef.current = false
      setExporting(false)
    }
  }

  // ── Logout ──
  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Proceed anyway
    }
    // Clear persisted active profile so the next login does not flash stale data
    setActiveProfile('', '')
    // Hard navigation drops any stale RSC/router cache
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign('/login')
  }

  const sectionVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.07, duration: 0.35 },
    }),
  }

  return (
    <>

      <PageContainer>
        <PageHeader title={t('settings.title')} />

        <div className="lg:grid lg:grid-cols-2 lg:gap-5 space-y-5 lg:space-y-0">
          {/* ── Left column ── */}
          <div className="space-y-6">
            {/* 1. Language & Appearance */}
            <motion.div
              custom={0}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              <SectionHeader title={<SectionTitle icon={Globe} tint={SECTION_TINT.appearance}>{t('settings.languageAndAppearance')}</SectionTitle>} />
              <Card tone="panel" padding="md" className="space-y-5">
                {/* Language */}
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {t('settings.language')}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{t('settings.languageDesc')}</p>
                  </div>
                  <SegmentedControl<Language>
                    options={[
                      { label: t('nav.langShortEn'), value: 'en' },
                      { label: 'বাং', value: 'bn' },
                    ]}
                    value={language}
                    onChange={handleLanguageChange}
                  />
                </div>

                <div className="h-px bg-[var(--color-border)]" />

                {/* Theme */}
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {t('settings.theme')}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{t('settings.themeDesc')}</p>
                  </div>
                  <SegmentedControl<Theme>
                    options={[
                      { label: <><Sun size={14} aria-hidden="true" />{t('settings.lightMode')}</>, value: 'light' },
                      { label: <><Moon size={14} aria-hidden="true" />{t('settings.darkMode')}</>, value: 'dark' },
                    ]}
                    value={theme}
                    onChange={handleThemeChange}
                  />
                </div>
              </Card>
            </motion.div>

            {/* 2. Notifications */}
            <motion.div
              custom={1}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              <SectionHeader title={<SectionTitle icon={Bell} tint={SECTION_TINT.notifications}>{t('settings.notifications')}</SectionTitle>} />
              <Card tone="panel" padding="md" className="divide-y divide-[var(--color-border)]">
                {[
                  {
                    key: 'periodAlert' as const,
                    label: t('settings.periodAlert'),
                    desc: t('settings.periodAlertDesc'),
                  },
                  {
                    key: 'fertileWindow' as const,
                    label: t('settings.fertileAlert'),
                    desc: t('settings.fertileAlertDesc'),
                  },
                  {
                    key: 'loggingReminder' as const,
                    label: t('settings.reminderAlert'),
                    desc: t('settings.reminderAlertDesc'),
                  },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{desc}</p>
                    </div>
                    <Toggle
                      id={key}
                      label={label}
                      checked={localPrefs[key]}
                      onChange={v => handleNotifChange(key, v)}
                    />
                  </div>
                ))}
                <div className="flex items-center gap-4 py-3">
                  <div className="flex-1 min-w-0">
                    <label
                      htmlFor="completionReminders"
                      className="text-sm font-semibold text-[var(--color-text-primary)] cursor-pointer"
                    >
                      {t('settings.completionReminders')}
                    </label>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {t('settings.completionRemindersDesc')}
                    </p>
                  </div>
                  <Toggle
                    id="completionReminders"
                    label={t('settings.completionReminders')}
                    checked={remindersEnabled}
                    onChange={handleRemindersChange}
                  />
                </div>
              </Card>
            </motion.div>
          </div>

          {/* ── Right column ── */}
          <div className="space-y-6">
            {/* 3. Data Export */}
            <motion.div
              custom={2}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              <SectionHeader title={<SectionTitle icon={Download} tint={SECTION_TINT.export}>{t('settings.export')}</SectionTitle>} />
              <Card tone="panel" padding="md" className="space-y-3">
                <p className="text-xs text-[var(--color-text-muted)]">
                  {t('settings.exportDesc')}
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="export-all-profiles"
                    checked={exportAll}
                    onChange={e => setExportAll(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--goal-accent)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--goal-accent)]"
                  />
                  <label
                    htmlFor="export-all-profiles"
                    className="flex-1 min-h-11 flex items-center text-xs text-[var(--color-text-muted)] cursor-pointer select-none"
                  >
                    {t('settings.exportAllProfiles')}
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleExportCsv}
                    disabled={exporting}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-transparent bg-tint-sky p-4 hover:border-[var(--color-accent-sky)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-[color,background-color,border-color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
                  >
                    <FileText size={22} className="text-accent-sky" aria-hidden="true" />
                    <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                      {t('settings.exportCsv')}
                    </span>
                  </button>
                  <button
                    onClick={handleExportExcel}
                    disabled={exporting}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-transparent bg-tint-mint p-4 hover:border-[var(--color-accent-mint)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-[color,background-color,border-color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
                  >
                    <FileSpreadsheet size={22} className="text-accent-mint" aria-hidden="true" />
                    <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                      {t('settings.exportExcel')}
                    </span>
                  </button>
                </div>
              </Card>
            </motion.div>

            {/* 4. Account */}
            <motion.div
              custom={3}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              <SectionHeader title={<SectionTitle icon={User} tint={SECTION_TINT.account}>{t('settings.account')}</SectionTitle>} />
              <Card tone="panel" padding="md" className="space-y-2">
                {/* Account info */}
                <div className="rounded-2xl bg-[var(--color-bg-secondary)] p-4 space-y-1.5">
                  {user.phone && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--color-text-muted)]">{t('settings.phone')}</span>
                      <span className="text-xs font-semibold text-[var(--color-text-primary)] font-mono">
                        {user.phone.startsWith('+') ? user.phone : `+${user.phone}`}
                      </span>
                    </div>
                  )}
                  {user.email && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--color-text-muted)]">{t('settings.email')}</span>
                      <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                        {user.email}
                      </span>
                    </div>
                  )}

                  {/* Add missing email */}
                  {!user.email && (
                    <div className="pt-1 border-t border-[var(--color-border)]">
                      {addingEmail ? (
                        <div>
                          <div className="flex items-center gap-2">
                            <label htmlFor="settings-contact-email" className="sr-only">{t('settings.email')}</label>
                            <input
                              id="settings-contact-email"
                              type="email"
                              name="email"
                              autoComplete="email"
                              placeholder={t('settings.emailInputPlaceholder')}
                              value={contactEmail}
                              onChange={(e) => { setContactEmail(e.target.value); if (emailError) setEmailError('') }}
                              className="flex-1 min-w-0 min-h-11 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-xs text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
                              spellCheck={false}
                            />
                            <button
                              onClick={handleAddEmail}
                              disabled={!contactEmail || contactSaving}
                              className="min-h-11 px-3 py-2 rounded-lg text-xs font-semibold text-[var(--color-on-accent)] bg-[var(--goal-accent)] disabled:opacity-50 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
                            >
                              {contactSaving ? '…' : t('common.save')}
                            </button>
                            <button
                              onClick={() => { setAddingEmail(false); setContactEmail(''); setEmailError('') }}
                              className="min-h-11 px-2 py-2 rounded-lg text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]"
                            >
                              {t('common.cancel')}
                            </button>
                          </div>
                          {emailError && (
                            <p role="alert" aria-live="polite" className="text-xs text-[var(--color-error)] mt-1">
                              {emailError}
                            </p>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAddingEmail(true); setEmailError('') }}
                          className="flex items-center gap-2 w-full min-h-11 text-xs font-medium text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]"
                        >
                          <Mail size={12} aria-hidden="true" />
                          {t('settings.addEmail')}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Add missing phone */}
                  {!user.phone && (
                    <div className="pt-1 border-t border-[var(--color-border)]">
                      {addingPhone ? (
                        <div>
                          <div className="flex items-center gap-2">
                            <label htmlFor="settings-contact-phone" className="sr-only">{t('settings.phone')}</label>
                            <input
                              id="settings-contact-phone"
                              type="tel"
                              name="phone"
                              autoComplete="tel"
                              placeholder={t('auth.phonePlaceholder')}
                              value={contactPhone}
                              onChange={(e) => { setContactPhone(e.target.value); if (phoneError) setPhoneError('') }}
                              className="flex-1 min-w-0 min-h-11 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-xs text-[var(--color-text-primary)] font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
                              spellCheck={false}
                            />
                            <button
                              onClick={handleAddPhone}
                              disabled={!contactPhone || contactSaving}
                              className="min-h-11 px-3 py-2 rounded-lg text-xs font-semibold text-[var(--color-on-accent)] bg-[var(--goal-accent)] disabled:opacity-50 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
                            >
                              {contactSaving ? '…' : t('common.save')}
                            </button>
                            <button
                              onClick={() => { setAddingPhone(false); setContactPhone(''); setPhoneError('') }}
                              className="min-h-11 px-2 py-2 rounded-lg text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]"
                            >
                              {t('common.cancel')}
                            </button>
                          </div>
                          {phoneError && (
                            <p role="alert" aria-live="polite" className="text-xs text-[var(--color-error)] mt-1">
                              {phoneError}
                            </p>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAddingPhone(true); setPhoneError('') }}
                          className="flex items-center gap-2 w-full min-h-11 text-xs font-medium text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]"
                        >
                          <Phone size={12} aria-hidden="true" />
                          {t('settings.addPhone')}
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border)]">
                    <span className="text-xs text-[var(--color-text-muted)]">{t('settings.plan')}</span>
                    {(() => {
                      const planTier = getSubscriptionTier(user)
                      return (
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            planTier === 'PRO'
                              ? 'bg-tint-peach text-accent-peach'
                              : planTier === 'LAPSED'
                              ? 'bg-[color-mix(in_srgb,var(--color-accent)_16%,var(--color-bg-card))] border border-[color-mix(in_srgb,var(--color-accent)_45%,transparent)] text-[var(--color-text-primary)]'
                              : 'bg-[var(--color-border)] text-[var(--color-text-muted)]'
                          }`}
                        >
                          <span className="uppercase">{planTier === 'PRO' ? t('subscription.pro') : planTier === 'LAPSED' ? t('subscription.planLapsed') : t('subscription.free')}</span>
                        </span>
                      )
                    })()}
                  </div>
                </div>

                {/* Nav links */}
                <div className="divide-y divide-[var(--color-border)]">
                  <AccountRow icon={Users} label={t('settings.manageProfiles')} href="/profiles" />
                  <AccountRow icon={MessageSquare} label={t('settings.giveFeedback')} href="/feedback" />
                  <AccountRow
                    icon={Crown}
                    label={t('nav.subscription')}
                    href="/subscription"
                    badge={!isProHelper(user) ? t('settings.upgradeLabel') : undefined}
                  />
                  <button
                    onClick={() => {
                      sessionStorage.setItem('vesta_replay_tour', '1')
                      router.push('/dashboard')
                    }}
                    className="flex items-center gap-3 py-3 px-1 w-full min-h-11 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)] rounded-sm"
                  >
                    <Compass
                      size={17}
                      className="text-[var(--color-text-muted)] group-hover:text-[var(--goal-accent)] transition-colors shrink-0"
                      aria-hidden="true"
                    />
                    <span className="flex-1 text-left min-w-0">
                      <span className="block text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">
                        {t('settings.replayTour')}
                      </span>
                      <span className="block text-xs text-[var(--color-text-muted)] mt-0.5">
                        {t('settings.replayTourDesc')}
                      </span>
                    </span>
                    <ChevronRight
                      size={15}
                      className="text-[var(--color-border)] group-hover:text-[var(--color-text-muted)] transition-colors shrink-0"
                      aria-hidden="true"
                    />
                  </button>
                </div>

                {/* Logout */}
                <div className="pt-1">
                  <Button
                    variant="outline"
                    fullWidth
                    onClick={() => setShowLogoutConfirm(true)}
                    className="border-[var(--color-error)] text-[var(--color-error)] hover:bg-[var(--color-error)] hover:text-[var(--color-on-action)] hover:border-[var(--color-error)]"
                  >
                    <LogOut aria-hidden="true" size={15} className="mr-2" />
                    {t('settings.logout')}
                  </Button>
                </div>
              </Card>
            </motion.div>

            {/* 5. About */}
            <motion.div
              custom={4}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              <SectionHeader title={<SectionTitle icon={Info} tint={SECTION_TINT.about}>{t('settings.about')}</SectionTitle>} />
              <Card tone="panel" padding="md" className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--color-text-secondary)]">{t('settings.appVersion')}</span>
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">{t('settings.versionName', { version: '2.0' })}</span>
                </div>

                <div className="rounded-2xl bg-tint-sage px-4 py-3 flex items-start gap-2">
                  <Lock aria-hidden="true" size={14} className="text-accent-sage mt-0.5 shrink-0" />
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    {t('settings.encryptionNote')}
                  </p>
                </div>

                <div className="flex items-center gap-4 pt-1">
                  <Link
                    href="/privacy"
                    className="text-xs text-[var(--color-secondary)] hover:underline font-medium"
                  >
                    {t('settings.privacyPolicy')}
                  </Link>
                  <span className="text-[var(--color-border)]">·</span>
                  <Link
                    href="/terms"
                    className="text-xs text-[var(--color-secondary)] hover:underline font-medium"
                  >
                    {t('settings.termsOfService')}
                  </Link>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </PageContainer>

      <LogoutConfirmModal
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        loggingOut={loggingOut}
        onConfirm={() => { setShowLogoutConfirm(false); handleLogout() }}
      />
    </>
  )
}

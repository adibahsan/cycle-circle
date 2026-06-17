'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'motion/react'
import {
  Globe,
  Moon,
  Sun,
  Bell,
  Download,
  User,
  Shield,
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
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import * as XLSX from 'xlsx'
import { updateNotificationPrefs, exportUserDataCsv, exportUserDataRows, updateProfileReminderOptOut } from '@/app/actions/settings-actions'
import { updateContactInfo } from '@/app/actions/user-actions'
import type { AuthUser } from '@vesta/shared/server/auth'
import type { Language, Theme } from '@vesta/shared/types'

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
  options: { label: string; value: T }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" className="flex items-center gap-0.5 p-0.5 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`relative flex-1 py-1.5 px-4 rounded-[10px] text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)] ${
              active
                ? 'text-white shadow-soft'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${options.map(o => o.value).join('-')}`}
                className="absolute inset-0 rounded-[10px] gradient-primary"
                transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              />
            )}
            <span className="relative">{opt.label}</span>
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
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)] ${
        checked ? 'gradient-primary' : 'bg-[var(--color-border)]'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', damping: 22, stiffness: 400 }}
        className="inline-block rounded-full bg-white shadow-soft"
        style={{ width: 18, height: 18, translateX: checked ? 20 : 4 }}
      />
    </button>
  )
}

interface ToastState {
  text: string
  seq: number // bumped on every message so the inner text crossfades
}

// Single-slot toast: only ever one on screen. New messages swap the text in
// place (and reset the auto-dismiss timer) rather than stacking a new toast.
function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((text: string) => {
    setToast(prev => ({ text, seq: (prev?.seq ?? 0) + 1 }))
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), 2500)
  }, [])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return { toast, show }
}

function Toast({ toast }: { toast: ToastState | null }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-full max-w-xs px-4 pointer-events-none"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast-bar"
            initial={{ opacity: 0, y: -16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.94 }}
            transition={{ type: 'spring', damping: 24, stiffness: 320 }}
            className="grid rounded-xl bg-[var(--color-text-primary)] text-white text-sm font-medium px-4 py-3 shadow-glow text-center"
          >
            {/* Spans share one grid cell, so swapping text crossfades without
                shifting the bar's position or height. */}
            <AnimatePresence>
              <motion.span
                key={toast.seq}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="col-start-1 row-start-1"
              >
                {toast.text}
              </motion.span>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center shrink-0">
        <Icon size={14} className="text-white" aria-hidden="true" />
      </div>
      <h2 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wide">
        {title}
      </h2>
    </div>
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
    <Link href={href} className="flex items-center gap-3 py-3 px-1 group">
      <Icon
        size={17}
        className="text-[var(--color-text-muted)] group-hover:text-[var(--goal-accent)] transition-colors shrink-0"
      />
      <span className="flex-1 text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">
        {label}
      </span>
      {badge && (
        <span className="flex items-center gap-1 text-xs font-bold text-white px-2 py-0.5 rounded-full gradient-primary">
          {badge}
        </span>
      )}
      <ChevronRight
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
  const { language, setLanguage, theme, setTheme, activeProfileId, setActiveProfile } = useAppStore()

  const { toast, show: showToast } = useToast()

  // Find the active profile's notification prefs, defaulting to all-on
  const activeProfile = profiles.find(p => p.id === activeProfileId) ?? profiles[0]
  const activePrefs = notifPrefs.find(p => p.profileId === activeProfile?.id)

  useEffect(() => {
    if (activeProfile) {
      setActiveProfile(activeProfile.id, activeProfile.name)
    }
  }, [activeProfile?.id, activeProfile?.name, setActiveProfile])

  const [localPrefs, setLocalPrefs] = useState({
    periodAlert: activePrefs?.periodAlert ?? true,
    fertileWindow: activePrefs?.fertileWindow ?? true,
    loggingReminder: activePrefs?.loggingReminder ?? true,
  })

  const [addingEmail, setAddingEmail] = useState(false)
  const [addingPhone, setAddingPhone] = useState(false)
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactSaving, setContactSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const exportingRef = useRef(false)
  const [loggingOut, setLoggingOut] = useState(false)
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
    try {
      await updateContactInfo({ email: contactEmail })
      showToast(t('settings.emailAdded'))
      setAddingEmail(false)
      setContactEmail('')
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vesta:profile-updated'))
      router.refresh()
    } catch {
      showToast(t('settings.emailAddFailed'))
    } finally {
      setContactSaving(false)
    }
  }

  const handleAddPhone = async () => {
    if (!contactPhone) return
    setContactSaving(true)
    try {
      await updateContactInfo({ phone: contactPhone })
      showToast(t('settings.phoneAdded'))
      setAddingPhone(false)
      setContactPhone('')
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vesta:profile-updated'))
      router.refresh()
    } catch {
      showToast(t('settings.phoneAddFailed'))
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
      const { csv, filename } = await exportUserDataCsv()
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
      const { periodLogs, symptomLogs, filename } = await exportUserDataRows()
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
    router.push('/login')
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
      <Toast toast={toast} />

      <div className="py-4 space-y-6">
        {/* ── Page title ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)]">
            {t('settings.title')}
          </h1>
        </motion.div>

        <div className="md:grid md:grid-cols-2 md:gap-6 space-y-6 md:space-y-0">
          {/* ── Left column ── */}
          <div className="space-y-6">
            {/* 1. Language & Appearance */}
            <motion.div
              custom={0}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              <SectionHeader icon={Globe} title={t('settings.languageAndAppearance')} />
              <Card padding="md" className="space-y-5">
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
                      { label: 'EN', value: 'en' },
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
                      { label: `☀️ ${t('settings.lightMode')}`, value: 'light' },
                      { label: `🌙 ${t('settings.darkMode')}`, value: 'dark' },
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
              <SectionHeader icon={Bell} title={t('settings.notifications')} />
              <Card padding="md" className="divide-y divide-[var(--color-border)]">
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
              <SectionHeader icon={Download} title={t('settings.export')} />
              <Card padding="md" className="space-y-3">
                <p className="text-xs text-[var(--color-text-muted)]">
                  {t('settings.exportDesc')}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleExportCsv}
                    disabled={exporting}
                    className="flex flex-col items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 hover:border-[var(--goal-accent)] hover:bg-[var(--color-bg-primary)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-[color,background-color,border-color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
                  >
                    <FileText size={22} className="text-[var(--color-secondary)]" aria-hidden="true" />
                    <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                      {t('settings.exportCsv')}
                    </span>
                  </button>
                  <button
                    onClick={handleExportExcel}
                    disabled={exporting}
                    className="flex flex-col items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 hover:border-[var(--goal-accent)] hover:bg-[var(--color-bg-primary)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-[color,background-color,border-color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
                  >
                    <FileSpreadsheet size={22} className="text-[var(--goal-accent)]" aria-hidden="true" />
                    <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
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
              <SectionHeader icon={User} title={t('settings.account')} />
              <Card padding="md" className="space-y-2">
                {/* Account info */}
                <div className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-3 space-y-1.5">
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
                        <div className="flex items-center gap-2">
                          <input
                            type="email"
                            name="email"
                            autoComplete="email"
                            placeholder={t('settings.emailInputPlaceholder')}
                            value={contactEmail}
                            onChange={(e) => setContactEmail(e.target.value)}
                            className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-xs text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
                            spellCheck={false}
                          />
                          <button
                            onClick={handleAddEmail}
                            disabled={!contactEmail || contactSaving}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white gradient-primary disabled:opacity-50 transition-opacity"
                          >
                            {contactSaving ? '...' : t('common.save')}
                          </button>
                          <button
                            onClick={() => { setAddingEmail(false); setContactEmail('') }}
                            className="px-2 py-1.5 rounded-lg text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddingEmail(true)}
                          className="flex items-center gap-2 w-full py-1 text-xs font-medium text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors"
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
                        <div className="flex items-center gap-2">
                          <input
                            type="tel"
                            name="phone"
                            autoComplete="tel"
                            placeholder="01XXXXXXXXX"
                            value={contactPhone}
                            onChange={(e) => setContactPhone(e.target.value)}
                            className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-xs text-[var(--color-text-primary)] font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
                            spellCheck={false}
                          />
                          <button
                            onClick={handleAddPhone}
                            disabled={!contactPhone || contactSaving}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white gradient-primary disabled:opacity-50 transition-opacity"
                          >
                            {contactSaving ? '...' : t('common.save')}
                          </button>
                          <button
                            onClick={() => { setAddingPhone(false); setContactPhone('') }}
                            className="px-2 py-1.5 rounded-lg text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddingPhone(true)}
                          className="flex items-center gap-2 w-full py-1 text-xs font-medium text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors"
                        >
                          <Phone size={12} aria-hidden="true" />
                          {t('settings.addPhone')}
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border)]">
                    <span className="text-xs text-[var(--color-text-muted)]">{t('settings.plan')}</span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        user.subscriptionStatus === 'pro'
                          ? 'gradient-primary text-white'
                          : 'bg-[var(--color-border)] text-[var(--color-text-muted)]'
                      }`}
                    >
                      {user.subscriptionStatus?.toUpperCase() ?? 'FREE'}
                    </span>
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
                    badge={user.subscriptionStatus !== 'pro' ? t('settings.upgradeLabel') : undefined}
                  />
                  <button
                    onClick={() => {
                      sessionStorage.setItem('vesta_replay_tour', '1')
                      router.push('/dashboard')
                    }}
                    className="flex items-center gap-3 py-3 px-1 w-full group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)] rounded-sm"
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
                    className="border-red-300 text-red-600 hover:bg-red-500 hover:text-white hover:border-red-500 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900 dark:hover:text-red-100 dark:hover:border-red-700"
                  >
                    <LogOut size={15} className="mr-2" />
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
              <SectionHeader icon={Info} title={t('settings.about')} />
              <Card padding="md" className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--color-text-secondary)]">{t('settings.appVersion')}</span>
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">Vesta v1.0</span>
                </div>

                <div className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] px-3 py-2.5 flex items-start gap-2">
                  <Lock size={14} className="text-[var(--color-secondary)] mt-0.5 shrink-0" />
                  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
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

        {/* Bottom spacer */}
        <div className="h-4" />
      </div>

      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowLogoutConfirm(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowLogoutConfirm(false) }}
          role="dialog"
          aria-modal="true"
          aria-label="Confirm logout"
        >
          <div
            className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 mx-4 max-w-sm w-full shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">
              {t('settings.logout')}
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-5">
              {t('settings.logoutConfirmMsg')}
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                fullWidth
                onClick={() => setShowLogoutConfirm(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={() => { setShowLogoutConfirm(false); handleLogout() }}
                disabled={loggingOut}
                className="bg-red-500 hover:bg-red-600 border-0"
              >
                {loggingOut ? t('settings.loggingOut') : t('settings.logout')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import {
  Globe, Moon, Sun, Bell, Download, User, Shield, LogOut,
  ChevronRight, Users, MessageSquare, Crown, FileSpreadsheet, FileText,
  Lock, Info,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { Language, Theme } from '@/lib/types';

// ─── Primitive components (inline, no separate files) ─────────────────────────

/** Segmented control — 2-option pill switcher */
function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`relative flex-1 py-1.5 px-4 rounded-[10px] text-sm font-semibold transition-all duration-200 ${
              active
                ? 'text-white shadow-soft'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${options.map((o) => o.value).join('-')}`}
                className="absolute inset-0 rounded-[10px] gradient-primary"
                transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              />
            )}
            <span className="relative">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Toggle switch — styled checkbox */
function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={id}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
        checked ? 'gradient-primary' : 'bg-[var(--color-border)]'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', damping: 22, stiffness: 400 }}
        className="inline-block h-4.5 w-4.5 rounded-full bg-white shadow-soft"
        style={{
          width: 18,
          height: 18,
          translateX: checked ? 20 : 4,
        }}
      />
    </button>
  );
}

/** Toast notification (auto-dismiss) */
interface ToastMsg { id: number; text: string }

function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const show = useCallback((text: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);
  return { toasts, show };
}

function ToastStack({ toasts }: { toasts: ToastMsg[] }) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 w-full max-w-xs px-4 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.94 }}
            className="rounded-xl bg-[var(--color-text-primary)] text-white text-sm font-medium px-4 py-3 shadow-glow text-center"
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Section header */
function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center shrink-0">
        <Icon size={14} className="text-white" />
      </div>
      <h2 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wide">
        {title}
      </h2>
    </div>
  );
}

/** Nav row inside Account section */
function AccountRow({
  icon: Icon,
  label,
  href,
  badge,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 py-3 px-1 group"
    >
      <Icon size={17} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors shrink-0" />
      <span className="flex-1 text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">
        {label}
      </span>
      {badge && (
        <span className="flex items-center gap-1 text-xs font-bold text-white px-2 py-0.5 rounded-full gradient-primary">
          {badge}
        </span>
      )}
      <ChevronRight size={15} className="text-[var(--color-border)] group-hover:text-[var(--color-text-muted)] transition-colors" />
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const {
    user,
    language,
    setLanguage,
    theme,
    setTheme,
    notificationPrefs,
    setNotificationPref,
    logout,
  } = useAppStore();

  const { toasts, show: showToast } = useToast();

  // ── Language handler ──
  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
  };

  // ── Theme handler ──
  const handleThemeChange = (t: Theme) => {
    setTheme(t);
    // Persist theme class on <html> for Tailwind dark variant
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // ── Export handlers ──
  const handleExportCsv = () => showToast('CSV download started');
  const handleExportExcel = () => showToast('Excel download started');

  // ── Logout ──
  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  // Stagger animation index helper
  const sectionVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.35 } }),
  };

  return (
    <>
      <ToastStack toasts={toasts} />

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
          {/* ── Left column: Language & Appearance, Notifications ── */}
          <div className="space-y-6">
            {/* ─────────────────────────────────────── */}
            {/* 1. Language & Appearance                */}
            {/* ─────────────────────────────────────── */}
            <motion.div custom={0} variants={sectionVariants} initial="hidden" animate="visible">
              <SectionHeader icon={Globe} title="Language & Appearance" />
              <Card padding="md" className="space-y-5">
                {/* Language */}
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {t('settings.language')}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      App display language
                    </p>
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
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      Visual appearance
                    </p>
                  </div>
                  <SegmentedControl<Theme>
                    options={[
                      { label: '☀️ Light', value: 'light' },
                      { label: '🌙 Dark', value: 'dark' },
                    ]}
                    value={theme}
                    onChange={handleThemeChange}
                  />
                </div>
              </Card>
            </motion.div>

            {/* ─────────────────────────────────────── */}
            {/* 2. Notifications                        */}
            {/* ─────────────────────────────────────── */}
            <motion.div custom={1} variants={sectionVariants} initial="hidden" animate="visible">
              <SectionHeader icon={Bell} title={t('settings.notifications')} />
              <Card padding="md" className="divide-y divide-[var(--color-border)]">
                {[
                  {
                    key: 'periodAlert' as const,
                    label: t('settings.periodAlert'),
                    desc: 'Get notified 2 days before your period',
                  },
                  {
                    key: 'fertileWindow' as const,
                    label: t('settings.fertileAlert'),
                    desc: 'Know when your fertile window opens',
                  },
                  {
                    key: 'loggingReminder' as const,
                    label: t('settings.reminderAlert'),
                    desc: 'Daily reminder to log your symptoms',
                  },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{desc}</p>
                    </div>
                    <Toggle
                      id={key}
                      checked={notificationPrefs[key]}
                      onChange={(v) => setNotificationPref(key, v)}
                    />
                  </div>
                ))}
              </Card>
            </motion.div>
          </div>

          {/* ── Right column: Data Export, Account, About ── */}
          <div className="space-y-6">
            {/* ─────────────────────────────────────── */}
            {/* 3. Data Export                          */}
            {/* ─────────────────────────────────────── */}
            <motion.div custom={2} variants={sectionVariants} initial="hidden" animate="visible">
              <SectionHeader icon={Download} title={t('settings.export')} />
              <Card padding="md" className="space-y-3">
                <p className="text-xs text-[var(--color-text-muted)]">
                  Exports data for your active profile only
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleExportCsv}
                    className="flex flex-col items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 hover:border-[var(--color-primary)] hover:bg-[var(--color-bg-primary)] active:scale-[0.97] transition-all duration-200"
                  >
                    <FileText size={22} className="text-[var(--color-secondary)]" />
                    <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                      {t('settings.exportCsv')}
                    </span>
                  </button>
                  <button
                    onClick={handleExportExcel}
                    className="flex flex-col items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 hover:border-[var(--color-primary)] hover:bg-[var(--color-bg-primary)] active:scale-[0.97] transition-all duration-200"
                  >
                    <FileSpreadsheet size={22} className="text-[var(--color-primary)]" />
                    <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                      {t('settings.exportExcel')}
                    </span>
                  </button>
                </div>
              </Card>
            </motion.div>

            {/* ─────────────────────────────────────── */}
            {/* 4. Account                              */}
            {/* ─────────────────────────────────────── */}
            <motion.div custom={3} variants={sectionVariants} initial="hidden" animate="visible">
              <SectionHeader icon={User} title="Account" />
              <Card padding="md" className="space-y-2">
                {/* Account info */}
                <div className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-3 space-y-1.5">
                  {user?.phone && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--color-text-muted)]">Phone</span>
                      <span className="text-xs font-semibold text-[var(--color-text-primary)] font-mono">
                        +{user.phone}
                      </span>
                    </div>
                  )}
                  {user?.email && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--color-text-muted)]">Email</span>
                      <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                        {user.email}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border)]">
                    <span className="text-xs text-[var(--color-text-muted)]">Plan</span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        user?.subscriptionStatus === 'pro'
                          ? 'gradient-primary text-white'
                          : 'bg-[var(--color-border)] text-[var(--color-text-muted)]'
                      }`}
                    >
                      {user?.subscriptionStatus?.toUpperCase() ?? 'FREE'}
                    </span>
                  </div>
                </div>

                {/* Nav links */}
                <div className="divide-y divide-[var(--color-border)]">
                  <AccountRow icon={Users} label="Manage Profiles" href="/profiles" />
                  <AccountRow icon={MessageSquare} label="Give Feedback" href="/feedback" />
                  <AccountRow
                    icon={Crown}
                    label="Subscription"
                    href="/subscription"
                    badge={user?.subscriptionStatus !== 'pro' ? 'Upgrade' : undefined}
                  />
                </div>

                {/* Logout */}
                <div className="pt-1">
                  <Button
                    variant="outline"
                    fullWidth
                    onClick={handleLogout}
                    className="border-red-300 text-red-500 hover:bg-red-50 hover:border-red-400 dark:hover:bg-red-950/20"
                  >
                    <LogOut size={15} className="mr-2" />
                    {t('settings.logout')}
                  </Button>
                </div>
              </Card>
            </motion.div>

            {/* ─────────────────────────────────────── */}
            {/* 5. About                                */}
            {/* ─────────────────────────────────────── */}
            <motion.div custom={4} variants={sectionVariants} initial="hidden" animate="visible">
              <SectionHeader icon={Info} title="About" />
              <Card padding="md" className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--color-text-secondary)]">App Version</span>
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">Vesta v1.0</span>
                </div>

                <div className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] px-3 py-2.5 flex items-start gap-2">
                  <Lock size={14} className="text-[var(--color-secondary)] mt-0.5 shrink-0" />
                  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                    Your health data is encrypted with AES-256-GCM and stored securely.
                  </p>
                </div>

                <div className="flex items-center gap-4 pt-1">
                  <Link
                    href="/privacy"
                    className="text-xs text-[var(--color-secondary)] hover:underline font-medium"
                  >
                    Privacy Policy
                  </Link>
                  <span className="text-[var(--color-border)]">·</span>
                  <Link
                    href="/terms"
                    className="text-xs text-[var(--color-secondary)] hover:underline font-medium"
                  >
                    Terms of Service
                  </Link>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>

        {/* Bottom spacer */}
        <div className="h-4" />
      </div>
    </>
  );
}

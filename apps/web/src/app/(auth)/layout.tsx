'use client';

import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, Droplet, Flower2, ChartLine } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { LanguageToggle } from '@/components/ui/LanguageToggle';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { theme, setTheme } = useAppStore();
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <div className="min-h-screen flex flex-col md:flex-row relative overflow-hidden bg-[var(--color-bg-primary)]">
      {/* ── Floating controls: theme + language toggle ── */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <LanguageToggle />
        <button
          onClick={toggleTheme}
          className="min-w-11 min-h-11 inline-flex items-center justify-center rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-soft hover:border-[var(--color-primary)] transition-colors duration-200 active:scale-95 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          aria-label={theme === 'dark' ? t('nav.switchToLight') : t('nav.switchToDark')}
        >
          {theme === 'dark' ? (
            <Sun size={18} className="text-[var(--color-text-primary)]" aria-hidden="true" />
          ) : (
            <Moon size={18} className="text-[var(--color-text-primary)]" aria-hidden="true" />
          )}
        </button>
      </div>
      {/* ── Desktop left panel: branding / illustration (md+) ── */}
      <div className="hidden md:flex md:w-1/2 lg:w-[55%] relative items-center justify-center overflow-hidden">
        {/* Decorative blobs for left panel */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -right-16 w-80 h-80 rounded-full opacity-25"
          style={{
            background: 'radial-gradient(circle, var(--color-secondary) 0%, transparent 70%)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)',
          }}
        />
        {/* Dot grid */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'radial-gradient(circle, var(--color-text-primary) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Branding content */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 px-12 lg:px-16 max-w-lg"
        >
          <BrandLogo size={160} className="w-32 h-32 lg:w-40 lg:h-40 mb-4" />
          <p className="text-4xl lg:text-5xl font-extrabold mb-4 text-[var(--color-text-primary)]" aria-hidden="true">
            Cycle Circle
          </p>
          <p className="text-lg lg:text-xl text-[var(--color-text-secondary)] leading-relaxed mb-6">
            {t('auth.brandBlurb')}
          </p>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
              <Droplet size={14} className="text-[var(--color-primary)]" aria-hidden="true" />
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">{t('auth.pillTracking')}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
              <Flower2 size={14} className="text-[var(--color-primary)]" aria-hidden="true" />
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">{t('auth.pillPredictions')}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
              <ChartLine size={14} className="text-[var(--color-primary)]" aria-hidden="true" />
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">{t('auth.pillInsights')}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Right panel / mobile full-screen: auth form ── */}
      <div className="flex-1 flex flex-col items-center justify-center relative min-h-screen md:min-h-0 md:border-l md:border-[var(--color-border)]">
        {/* Mobile-only decorative blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -left-32 w-80 h-80 rounded-full opacity-25 md:opacity-10"
          style={{
            background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -right-24 w-72 h-72 rounded-full opacity-20 md:opacity-10"
          style={{
            background: 'radial-gradient(circle, var(--color-secondary) 0%, transparent 70%)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-10 md:hidden"
          style={{
            background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)',
          }}
        />

        {/* Subtle dot-grid pattern */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'radial-gradient(circle, var(--color-text-primary) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Content container */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-sm px-4 py-8 md:px-8 md:max-w-md"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

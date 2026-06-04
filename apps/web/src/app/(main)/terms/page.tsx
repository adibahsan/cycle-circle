'use client';

import { motion } from 'motion/react';
import { FileText, Stethoscope, Users, Crown, Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SectionProps {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  index: number;
}

// ─── Section component ────────────────────────────────────────────────────────

function TermsSection({ icon: Icon, title, children, index }: SectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07 }}
    >
      <Card padding="md" className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center shrink-0">
            <Icon size={16} className="text-white" aria-hidden="true" />
          </div>
          <h2 className="text-base font-bold text-[var(--color-text-primary)]">{title}</h2>
        </div>
        <div className="space-y-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
          {children}
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TermsPage() {
  const { t } = useTranslation();

  const sections = [
    {
      icon: FileText,
      title: t('terms.acceptanceTitle'),
      content: (
        <p>{t('terms.acceptanceBody')}</p>
      ),
    },
    {
      icon: Stethoscope,
      title: t('terms.serviceTitle'),
      content: (
        <div className="space-y-2">
          <p>{t('terms.serviceIntro')}</p>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li>{t('terms.serviceFeature1')}</li>
            <li>{t('terms.serviceFeature2')}</li>
            <li>{t('terms.serviceFeature3')}</li>
            <li>{t('terms.serviceFeature4')}</li>
          </ul>
          <div className="mt-3 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] px-3 py-2.5 flex items-start gap-2">
            <AlertCircle size={13} className="text-amber-500 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-xs text-[var(--color-text-muted)]">
              {t('terms.serviceDisclaimer')}
            </p>
          </div>
        </div>
      ),
    },
    {
      icon: Users,
      title: t('terms.accountsTitle'),
      content: (
        <div className="space-y-2">
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li>{t('terms.accountsBullet1')}</li>
            <li>{t('terms.accountsBullet2')}</li>
            <li>{t('terms.accountsBullet3')}</li>
            <li>{t('terms.accountsBullet4')}</li>
          </ul>
        </div>
      ),
    },
    {
      icon: Crown,
      title: t('terms.subscriptionTitle'),
      content: (
        <div className="space-y-2">
          <p>{t('terms.subscriptionIntro')}</p>
          <ul className="list-disc list-inside space-y-1 pl-1 mt-1">
            <li>{t('terms.subscriptionBullet1')}</li>
            <li>{t('terms.subscriptionBullet2')}</li>
            <li>{t('terms.subscriptionBullet3')}</li>
            <li>{t('terms.subscriptionBullet4')}</li>
          </ul>
        </div>
      ),
    },
    {
      icon: Lock,
      title: t('terms.privacyTitle'),
      content: (
        <div className="space-y-2">
          <p>
            {t('terms.privacyIntro').split(t('terms.privacyPolicyLink')).map((part, i, arr) =>
              i < arr.length - 1 ? (
                <span key={i}>
                  {part}
                  <a href="/privacy" className="text-[var(--color-secondary)] hover:underline font-medium">
                    {t('terms.privacyPolicyLink')}
                  </a>
                </span>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </p>
          <ul className="list-disc list-inside space-y-1 pl-1 mt-1">
            <li>{t('terms.privacyBullet1')}</li>
            <li>{t('terms.privacyBullet2')}</li>
            <li>{t('terms.privacyBullet3')}</li>
          </ul>
        </div>
      ),
    },
    {
      icon: AlertCircle,
      title: t('terms.limitationsTitle'),
      content: (
        <div className="space-y-2">
          <p>{t('terms.limitationsIntro')}</p>
          <ul className="list-disc list-inside space-y-1 pl-1 mt-1">
            <li>{t('terms.limitationsBullet1')}</li>
            <li>{t('terms.limitationsBullet2')}</li>
            <li>{t('terms.limitationsBullet3')}</li>
          </ul>
        </div>
      ),
    },
    {
      icon: RefreshCw,
      title: t('terms.changesTitle'),
      content: (
        <div className="space-y-2">
          <p>{t('terms.changesBody1')}</p>
          <p>{t('terms.changesBody2')}</p>
        </div>
      ),
    },
  ];

  return (
    <div className="py-4 space-y-6">
      {/* ── Page header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)]">
          {t('terms.pageTitle')}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('terms.effectiveDate')}</p>
      </motion.div>

      {/* ── Intro blurb ── */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="text-sm text-[var(--color-text-secondary)] leading-relaxed max-w-2xl"
      >
        {t('terms.introParagraph')}
      </motion.p>

      {/* ── Sections ── */}
      <div className="max-w-2xl space-y-4">
        {sections.map((section, i) => (
          <TermsSection
            key={section.title}
            icon={section.icon}
            title={section.title}
            index={i + 1}
          >
            {section.content}
          </TermsSection>
        ))}
      </div>

      {/* Bottom spacer */}
      <div className="h-4" />
    </div>
  );
}

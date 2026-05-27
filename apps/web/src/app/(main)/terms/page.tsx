'use client';

import { motion } from 'motion/react';
import { FileText, Stethoscope, Users, Crown, Lock, AlertCircle, RefreshCw } from 'lucide-react';
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
            <Icon size={16} className="text-white" />
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
  const sections = [
    {
      icon: FileText,
      title: 'Acceptance of Terms',
      content: (
        <p>
          By downloading, installing, or using Vesta you agree to be bound by these Terms &amp;
          Conditions. If you do not agree with any part of these terms, please do not use the
          application.
        </p>
      ),
    },
    {
      icon: Stethoscope,
      title: 'Service Description',
      content: (
        <div className="space-y-2">
          <p>Vesta provides the following features:</p>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li>Menstrual cycle tracking and period prediction</li>
            <li>Fertile window estimation</li>
            <li>Symptom and mood logging</li>
            <li>Bilingual content (English and Bengali)</li>
          </ul>
          <div className="mt-3 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] px-3 py-2.5 flex items-start gap-2">
            <AlertCircle size={13} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-[var(--color-text-muted)]">
              <strong>Vesta is not a medical device.</strong> Content provided is for informational
              purposes only and does not constitute medical advice, diagnosis, or treatment.
            </p>
          </div>
        </div>
      ),
    },
    {
      icon: Users,
      title: 'Account & Profiles',
      content: (
        <div className="space-y-2">
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li>One account is permitted per phone number.</li>
            <li>Each account supports up to 6 individual profiles.</li>
            <li>
              You are solely responsible for maintaining the accuracy of data entered across all
              profiles on your account.
            </li>
            <li>
              You must not share your account credentials or allow unauthorised access to your
              account.
            </li>
          </ul>
        </div>
      ),
    },
    {
      icon: Crown,
      title: 'Subscription (Pro)',
      content: (
        <div className="space-y-2">
          <p>
            Vesta Pro is available for <strong>৳99/month</strong>, billed via BDApps Content &amp;
            Application Aggregation Service (CAAS).
          </p>
          <ul className="list-disc list-inside space-y-1 pl-1 mt-1">
            <li>Charges are applied directly to your Grameenphone mobile balance.</li>
            <li>Billing is monthly and renews automatically unless cancelled.</li>
            <li>You may cancel at any time from Settings; access continues until the end of the current billing period.</li>
            <li>Refunds are subject to BDApps billing policies.</li>
          </ul>
        </div>
      ),
    },
    {
      icon: Lock,
      title: 'Data & Privacy',
      content: (
        <div className="space-y-2">
          <p>
            Your use of Vesta is also governed by our{' '}
            <a href="/privacy" className="text-[var(--color-secondary)] hover:underline font-medium">
              Privacy Policy
            </a>
            , which is incorporated into these Terms by reference.
          </p>
          <ul className="list-disc list-inside space-y-1 pl-1 mt-1">
            <li>All health data is encrypted at rest with AES-256-GCM.</li>
            <li>We do not sell, rent, or share your personal or health data with third parties for commercial purposes.</li>
            <li>You may request export or deletion of your data at any time.</li>
          </ul>
        </div>
      ),
    },
    {
      icon: AlertCircle,
      title: 'Limitations & Disclaimer',
      content: (
        <div className="space-y-2">
          <p>
            Cycle predictions and fertile window estimates are algorithmic approximations based on
            the data you provide. They are <strong>not</strong> a substitute for professional
            medical advice.
          </p>
          <ul className="list-disc list-inside space-y-1 pl-1 mt-1">
            <li>Do not rely on Vesta for contraception or family planning decisions.</li>
            <li>Always consult a qualified healthcare professional for medical decisions.</li>
            <li>
              Vesta is provided "as is" without warranties of any kind, including accuracy of
              predictions or uninterrupted service.
            </li>
          </ul>
        </div>
      ),
    },
    {
      icon: RefreshCw,
      title: 'Changes to Terms',
      content: (
        <div className="space-y-2">
          <p>
            We may update these Terms & Conditions from time to time. When we do, we will update
            the effective date at the top of this page.
          </p>
          <p>
            Your continued use of Vesta after changes are posted constitutes your acceptance of
            the revised terms. If you disagree with updated terms, you may stop using the app and
            request account deletion.
          </p>
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
          Terms &amp; Conditions
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Effective: May 2026</p>
      </motion.div>

      {/* ── Intro blurb ── */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="text-sm text-[var(--color-text-secondary)] leading-relaxed max-w-2xl"
      >
        Please read these Terms & Conditions carefully before using Vesta. They set out your
        rights and responsibilities when using our cycle-tracking application.
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

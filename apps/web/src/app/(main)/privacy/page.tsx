'use client';

import { motion } from 'motion/react';
import { Shield, Database, Lock, Users, ExternalLink, CheckCircle, Mail } from 'lucide-react';
import { Card } from '@/components/ui/Card';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SectionProps {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  index: number;
}

// ─── Section component ────────────────────────────────────────────────────────

function PolicySection({ icon: Icon, title, children, index }: SectionProps) {
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

function BulletItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <CheckCircle size={14} className="text-[var(--color-secondary)] mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrivacyPolicyPage() {
  const sections = [
    {
      icon: Database,
      title: 'Data Collection',
      content: (
        <div className="space-y-2">
          <p>We collect only what is necessary to provide Vesta's services:</p>
          <div className="space-y-1.5 mt-2">
            <BulletItem>
              <strong>Phone number</strong> — used for authentication via BDApps OTP
            </BulletItem>
            <BulletItem>
              <strong>Cycle data</strong> — period start/end dates, cycle length, and predictions
            </BulletItem>
            <BulletItem>
              <strong>Symptom logs</strong> — mood, flow intensity, pain levels, and notes you enter
            </BulletItem>
            <BulletItem>
              <strong>Profile information</strong> — name and any details you choose to provide per profile
            </BulletItem>
          </div>
          <div className="mt-3 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] px-3 py-2.5 flex items-start gap-2">
            <Lock size={13} className="text-[var(--color-secondary)] mt-0.5 shrink-0" />
            <p className="text-xs text-[var(--color-text-muted)]">
              All health data is encrypted at rest using AES-256-GCM before storage.
            </p>
          </div>
        </div>
      ),
    },
    {
      icon: Shield,
      title: 'How We Use Your Data',
      content: (
        <div className="space-y-2">
          <p>Your data is used exclusively to power Vesta's features:</p>
          <div className="space-y-1.5 mt-2">
            <BulletItem>Generate accurate cycle predictions and fertile window estimates</BulletItem>
            <BulletItem>Deliver personalised content and health insights in your chosen language</BulletItem>
            <BulletItem>Send push or SMS notifications when you have them enabled</BulletItem>
          </div>
          <p className="mt-2 font-semibold text-[var(--color-text-primary)]">
            Your data is never sold to third parties — ever.
          </p>
        </div>
      ),
    },
    {
      icon: Database,
      title: 'Data Storage',
      content: (
        <div className="space-y-2">
          <p>
            Your data is stored on <strong>Supabase</strong> (PostgreSQL), a SOC 2-compliant
            infrastructure provider hosted on AWS.
          </p>
          <div className="space-y-1.5 mt-2">
            <BulletItem>
              <strong>Row Level Security (RLS)</strong> is enforced on every table — each user can
              only ever read and write their own rows.
            </BulletItem>
            <BulletItem>
              All database connections are encrypted in transit via TLS 1.3.
            </BulletItem>
            <BulletItem>
              Backups are encrypted and retained for 7 days.
            </BulletItem>
          </div>
        </div>
      ),
    },
    {
      icon: Users,
      title: 'Data Isolation (Multi-Profile)',
      content: (
        <div className="space-y-2">
          <p>
            Vesta supports up to 6 profiles under a single account. Profile data is completely
            isolated at the database level.
          </p>
          <div className="space-y-1.5 mt-2">
            <BulletItem>Each profile has its own encrypted data partition.</BulletItem>
            <BulletItem>One profile's cycle logs, symptoms, and notes never appear in another profile's view.</BulletItem>
            <BulletItem>Switching profiles requires an in-app PIN, preventing accidental cross-access.</BulletItem>
          </div>
        </div>
      ),
    },
    {
      icon: ExternalLink,
      title: 'Third-Party Services',
      content: (
        <div className="space-y-2">
          <p>We use a minimal set of third-party services to run Vesta:</p>
          <div className="space-y-1.5 mt-2">
            <BulletItem>
              <strong>BDApps</strong> — handles phone authentication (OTP) and in-app billing via
              CAAS. Only your phone number is shared for authentication purposes.
            </BulletItem>
            <BulletItem>
              <strong>Resend</strong> — transactional email notifications (if you provide an email
              address). No health data is included in emails.
            </BulletItem>
          </div>
          <p className="mt-2 text-[var(--color-text-muted)] text-xs">
            No advertising networks, analytics trackers, or data brokers have access to your health data.
          </p>
        </div>
      ),
    },
    {
      icon: CheckCircle,
      title: 'Your Rights',
      content: (
        <div className="space-y-2">
          <p>You are in full control of your data:</p>
          <div className="space-y-1.5 mt-2">
            <BulletItem>
              <strong>Export</strong> — download all your cycle and symptom data as CSV or Excel
              from Settings at any time.
            </BulletItem>
            <BulletItem>
              <strong>Delete</strong> — request full account deletion; all your data is permanently
              removed within 30 days.
            </BulletItem>
            <BulletItem>
              <strong>Opt out</strong> — disable all notifications individually from Settings at
              any time, no questions asked.
            </BulletItem>
          </div>
        </div>
      ),
    },
    {
      icon: Mail,
      title: 'Contact Us',
      content: (
        <div className="space-y-2">
          <p>
            If you have questions about this Privacy Policy or want to exercise your rights,
            please reach out to us:
          </p>
          <div className="mt-2 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] px-4 py-3">
            <a
              href="mailto:support@vesta.health"
              className="text-[var(--color-secondary)] font-semibold hover:underline"
            >
              support@vesta.health
            </a>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            We aim to respond within 2 business days.
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
          Privacy Policy
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Last updated: May 2026</p>
      </motion.div>

      {/* ── Intro blurb ── */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="text-sm text-[var(--color-text-secondary)] leading-relaxed max-w-2xl"
      >
        Vesta is a personal health companion. We take privacy seriously — especially for
        sensitive health data. This policy explains exactly what we collect, why, and how we
        protect it.
      </motion.p>

      {/* ── Sections ── */}
      <div className="max-w-2xl space-y-4">
        {sections.map((section, i) => (
          <PolicySection
            key={section.title}
            icon={section.icon}
            title={section.title}
            index={i + 1}
          >
            {section.content}
          </PolicySection>
        ))}
      </div>

      {/* Bottom spacer */}
      <div className="h-4" />
    </div>
  );
}

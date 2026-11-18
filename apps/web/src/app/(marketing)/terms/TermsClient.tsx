'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Stethoscope,
  Users,
  Crown,
  Lock,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  Mail,
} from 'lucide-react';
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { ContactBlock } from '@/components/legal/ContactBlock';
import { LegalSection } from '@/components/legal/LegalSection';
import { useProPriceVars } from '@/components/ProPriceProvider';
import type { CustomerProPrice } from '@/app/queries/pro-price-queries';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BulletItem {
  term?: string;
  desc: string;
}

// ─── Bullet list helper ────────────────────────────────────────────────────────

function BulletList({ items }: { items: BulletItem[] }) {
  return (
    <ul className="space-y-1.5 mt-2 list-none p-0 m-0">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <CheckCircle
            size={14}
            aria-hidden="true"
            className="text-[var(--color-secondary)] mt-0.5 shrink-0"
          />
          <span>
            {item.term ? (
              <>
                <strong className="text-[var(--color-text-primary)]">{item.term}</strong>
                {' — '}
                {item.desc}
              </>
            ) : (
              item.desc
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function TermsClient({ price }: { price: CustomerProPrice | null }) {
  const { t } = useTranslation();
  const proPrice = useProPriceVars(price);

  const serviceFeatures = t('terms.sections.service.features', {
    returnObjects: true,
  }) as string[];

  const accountItems = t('terms.sections.accounts.items', {
    returnObjects: true,
  }) as BulletItem[];

  const subscriptionItems = t('terms.sections.subscription.items', {
    returnObjects: true,
  }) as BulletItem[];

  const dataItems = t('terms.sections.data.items', {
    returnObjects: true,
  }) as BulletItem[];

  const limitationItems = t('terms.sections.limitations.items', {
    returnObjects: true,
  }) as BulletItem[];

  return (
    <LegalPageShell
      title={t('terms.title')}
      dateLabel={t('terms.effective')}
      intro={t('terms.intro')}
    >
      {/* 1. Acceptance */}
      <LegalSection key="acceptance" icon={FileText} title={t('terms.sections.acceptance.title')}>
        <p>{t('terms.sections.acceptance.body')}</p>
      </LegalSection>

      {/* 2. Service */}
      <LegalSection key="service" icon={Stethoscope} title={t('terms.sections.service.title')}>
        <p>{t('terms.sections.service.intro')}</p>
        <BulletList items={serviceFeatures.map((desc) => ({ desc }))} />
        <div className="mt-3 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] px-3 py-2.5 flex items-start gap-2">
          <AlertCircle
            size={13}
            aria-hidden="true"
            className="text-amber-500 mt-0.5 shrink-0"
          />
          <p className="text-xs text-[var(--color-text-muted)]">
            {t('terms.sections.service.disclaimer')}
          </p>
        </div>
      </LegalSection>

      {/* 3. Accounts */}
      <LegalSection key="accounts" icon={Users} title={t('terms.sections.accounts.title')}>
        <BulletList items={accountItems} />
      </LegalSection>

      {/* 4. Subscription */}
      <LegalSection key="subscription" id="bdapps" icon={Crown} title={t('terms.sections.subscription.title')}>
        <p>{proPrice ? t('terms.sections.subscription.intro', proPrice) : t('terms.sections.subscription.introNoPrice')}</p>
        <BulletList items={subscriptionItems} />
      </LegalSection>

      {/* 5. Data */}
      <LegalSection key="data" icon={Lock} title={t('terms.sections.data.title')}>
        <p>{t('terms.sections.data.body')}</p>
        <BulletList items={dataItems} />
        <p className="mt-2">
          <Link
            href="/privacy"
            className="inline-flex items-center gap-1 text-[var(--color-secondary)] hover:underline font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 rounded"
          >
            {t('privacy.title')} →
          </Link>
        </p>
      </LegalSection>

      {/* 6. Limitations */}
      <LegalSection
        key="limitations"
        icon={AlertCircle}
        title={t('terms.sections.limitations.title')}
      >
        <p>{t('terms.sections.limitations.body')}</p>
        <BulletList items={limitationItems} />
      </LegalSection>

      {/* 7. Changes */}
      <LegalSection key="changes" icon={RefreshCw} title={t('terms.sections.changes.title')}>
        <p>{t('terms.sections.changes.body1')}</p>
        <p>{t('terms.sections.changes.body2')}</p>
      </LegalSection>

      {/* 8. Contact */}
      <LegalSection key="contact" icon={Mail} title={t('contactInfo.heading')}>
        <div className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] px-4 py-3">
          <ContactBlock />
        </div>
      </LegalSection>
    </LegalPageShell>
  );
}

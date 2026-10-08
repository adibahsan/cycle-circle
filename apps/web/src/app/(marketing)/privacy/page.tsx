'use client';

import { useTranslation } from 'react-i18next';
import {
  Database,
  Shield,
  Users,
  ExternalLink,
  CheckCircle,
  Mail,
  Lock,
} from 'lucide-react';
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { ContactBlock } from '@/components/legal/ContactBlock';
import { LegalSection } from '@/components/legal/LegalSection';

// ─── Bullet list helper ───────────────────────────────────────────────────────

interface BulletItem {
  term?: string;
  desc: string;
}

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

export default function PrivacyPage() {
  const { t } = useTranslation();

  const collectionItems = t('privacy.sections.collection.items', {
    returnObjects: true,
  }) as BulletItem[];

  const usageItems = t('privacy.sections.usage.items', {
    returnObjects: true,
  }) as BulletItem[];

  const storageItems = t('privacy.sections.storage.items', {
    returnObjects: true,
  }) as BulletItem[];

  const isolationItems = t('privacy.sections.isolation.items', {
    returnObjects: true,
  }) as BulletItem[];

  const thirdPartyItems = t('privacy.sections.thirdParty.items', {
    returnObjects: true,
  }) as BulletItem[];

  const rightsItems = t('privacy.sections.rights.items', {
    returnObjects: true,
  }) as BulletItem[];

  return (
    <LegalPageShell
      title={t('privacy.title')}
      dateLabel={t('privacy.updated')}
      intro={t('privacy.intro')}
    >
      {/* 1. collection */}
      <LegalSection icon={Database} title={t('privacy.sections.collection.title')} key="collection">
        <p>{t('privacy.sections.collection.intro')}</p>
        <BulletList items={collectionItems} />
        <div className="mt-3 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] px-3 py-2.5 flex items-start gap-2">
          <Lock
            size={13}
            aria-hidden="true"
            className="text-[var(--color-secondary)] mt-0.5 shrink-0"
          />
          <p className="text-xs text-[var(--color-text-muted)]">
            {t('privacy.sections.collection.callout')}
          </p>
        </div>
      </LegalSection>

      {/* 2. usage */}
      <LegalSection icon={Shield} title={t('privacy.sections.usage.title')} key="usage">
        <p>{t('privacy.sections.usage.intro')}</p>
        <BulletList items={usageItems} />
        <p className="mt-2 font-semibold text-[var(--color-text-primary)]">
          {t('privacy.sections.usage.emphasis')}
        </p>
      </LegalSection>

      {/* 3. storage */}
      <LegalSection icon={Database} title={t('privacy.sections.storage.title')} key="storage">
        <p>{t('privacy.sections.storage.intro')}</p>
        <BulletList items={storageItems} />
      </LegalSection>

      {/* 4. isolation */}
      <LegalSection icon={Users} title={t('privacy.sections.isolation.title')} key="isolation">
        <p>{t('privacy.sections.isolation.intro')}</p>
        <BulletList items={isolationItems} />
      </LegalSection>

      {/* 5. thirdParty */}
      <LegalSection
        icon={ExternalLink}
        title={t('privacy.sections.thirdParty.title')}
        key="thirdParty"
      >
        <p>{t('privacy.sections.thirdParty.intro')}</p>
        <BulletList items={thirdPartyItems} />
        <p className="mt-2 text-[var(--color-text-muted)] text-xs">
          {t('privacy.sections.thirdParty.note')}
        </p>
      </LegalSection>

      {/* 6. rights */}
      <LegalSection icon={CheckCircle} title={t('privacy.sections.rights.title')} key="rights">
        <p>{t('privacy.sections.rights.intro')}</p>
        <BulletList items={rightsItems} />
      </LegalSection>

      {/* 7. contact */}
      <LegalSection icon={Mail} title={t('privacy.sections.contact.title')} key="contact">
        <p>{t('privacy.sections.contact.intro')}</p>
        <div className="mt-2 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] px-4 py-3">
          <ContactBlock />
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-2">
          {t('privacy.sections.contact.response')}
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}

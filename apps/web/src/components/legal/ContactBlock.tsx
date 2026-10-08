'use client';

import { Mail, MapPin, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** `+880 18102 04718` -> `tel:+8801810204718` */
export function toTelHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

const LINK_CLASS =
  'font-semibold text-[var(--color-text-primary)] underline underline-offset-2 decoration-[var(--color-border)] hover:decoration-[var(--color-text-primary)] transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)] rounded';

interface ContactBlockProps {
  /** Show the "Contact us" heading (footer); legal sections already have their own title. */
  showHeading?: boolean;
  className?: string;
}

export function ContactBlock({ showHeading = false, className }: ContactBlockProps) {
  const { t } = useTranslation();
  const email = t('contactInfo.email');
  const phone = t('contactInfo.phone');

  return (
    <div className={className}>
      {showHeading && (
        <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-2">
          {t('contactInfo.heading')}
        </h2>
      )}
      <dl className="space-y-2 text-sm text-[var(--color-text-secondary)]">
        <div className="flex items-start gap-2">
          <dt className="sr-only">{t('contactInfo.emailLabel')}</dt>
          <Mail size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <dd>
            <a href={`mailto:${email}`} className={LINK_CLASS} spellCheck={false}>
              {email}
            </a>
          </dd>
        </div>
        <div className="flex items-start gap-2">
          <dt className="sr-only">{t('contactInfo.phoneLabel')}</dt>
          <Phone size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <dd>
            <a
              href={toTelHref(phone)}
              className={LINK_CLASS}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {phone}
            </a>
          </dd>
        </div>
        <div className="flex items-start gap-2">
          <dt className="sr-only">{t('contactInfo.addressLabel')}</dt>
          <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <dd>
            <address className="not-italic">{t('contactInfo.address')}</address>
          </dd>
        </div>
      </dl>
    </div>
  );
}

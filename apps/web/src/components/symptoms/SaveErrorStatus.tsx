'use client';

import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import '@vesta/shared/utils/i18n';

/** Polite live region that announces a failed symptom save. Stays mounted so the message is announced. */
export function SaveErrorStatus({ show, className = '' }: { show: boolean; className?: string }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" className={className}>
      {show && (
        <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-[var(--color-error)]">
          <AlertCircle size={16} aria-hidden="true" className="shrink-0" />
          {t('symptoms.saveError')}
        </p>
      )}
    </div>
  );
}

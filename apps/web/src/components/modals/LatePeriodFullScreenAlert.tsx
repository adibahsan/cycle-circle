'use client';

import { HeartHandshake } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { goalAccentVar } from '@vesta/shared/utils/goal';
import '@vesta/shared/utils/i18n';

export interface LatePeriodFullScreenAlertProps {
  open: boolean;
  onClose: () => void;
  daysLate: number;
  goal: string | null;
  onLogPeriod: () => void;
}

/** Late-period alert: an auto-prompt (layer "prompt") on the pop-up shell. */
export function LatePeriodFullScreenAlert({
  open,
  onClose,
  daysLate,
  goal,
  onLogPeriod,
}: LatePeriodFullScreenAlertProps) {
  const { t } = useTranslation();
  const accentVar = goalAccentVar(goal);

  function handleLogPeriod() {
    onClose();
    onLogPeriod();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      layer="prompt"
      titleId="late-alert-title"
      descId="late-alert-desc"
      accentVar={accentVar}
      panelClassName="sm:max-w-sm"
    >
      <div
        className="flex flex-col items-center gap-5 text-center px-6 pt-10 pb-6"
        style={{ ['--goal-accent']: accentVar } as React.CSSProperties}
      >
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'color-mix(in srgb, var(--goal-accent) 16%, transparent)' }}
          aria-hidden="true"
        >
          <HeartHandshake size={34} aria-hidden="true" style={{ color: 'var(--goal-accent)' }} />
        </div>

        <h2 id="late-alert-title" className="text-2xl font-bold text-[var(--color-text-primary)] leading-snug">
          {t('latePeriod.title')}
        </h2>

        <p id="late-alert-desc" className="text-base text-[var(--color-text-secondary)] max-w-xs leading-relaxed">
          {t('latePeriod.body', { count: daysLate })}
        </p>

        <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            data-autofocus
            onClick={handleLogPeriod}
            style={{ background: 'var(--goal-accent)', borderColor: 'var(--goal-accent)' } as React.CSSProperties}
          >
            {t('latePeriod.logCta')}
          </Button>
          <Button variant="ghost" size="lg" fullWidth onClick={onClose}>
            {t('latePeriod.later')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

'use client';

import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface LogoutConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loggingOut?: boolean;
}

/** Shared logout confirmation (Settings + onboarding account control) on the pop-up shell. */
export function LogoutConfirmModal({ open, onClose, onConfirm, loggingOut = false }: LogoutConfirmModalProps) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onClose} titleId="logout-confirm-title" descId="logout-confirm-desc" panelClassName="sm:max-w-sm">
      <div className="p-6 pt-8">
        <h2 id="logout-confirm-title" className="text-lg font-bold text-[var(--color-text-primary)] mb-2 pr-8">
          {t('settings.logout')}
        </h2>
        <p id="logout-confirm-desc" className="text-sm text-[var(--color-text-muted)] mb-5">
          {t('settings.logoutConfirmMsg')}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" fullWidth onClick={onClose} data-autofocus>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            fullWidth
            onClick={onConfirm}
            disabled={loggingOut}
            className="bg-[var(--color-error)] hover:opacity-90 text-[var(--color-on-action)] border-0"
          >
            {loggingOut ? t('settings.loggingOut') : t('settings.logout')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

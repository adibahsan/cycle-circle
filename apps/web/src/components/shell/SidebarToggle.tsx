'use client';

import { useTranslation } from 'react-i18next';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export function SidebarToggle({
  collapsed,
  onToggle,
  controlsId,
}: {
  collapsed: boolean;
  onToggle: () => void;
  controlsId: string;
}) {
  const { t } = useTranslation();
  const label = collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar');
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      aria-expanded={!collapsed}
      aria-controls={controlsId}
      className="sb-toggle ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]"
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}

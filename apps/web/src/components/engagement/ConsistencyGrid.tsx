'use client';

import { deviceDayString } from '@/lib/local-date';
import { motion } from 'motion/react';
import { useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useHasMounted } from '@/components/motion/useHasMounted';
import { useAppStore } from '@/lib/store';
import '@vesta/shared/utils/i18n';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ConsistencyEntry {
  date: string;
  logged: boolean;
}

interface ConsistencyGridProps {
  last30: ConsistencyEntry[];
  onBackfill: (date: string) => void;
  variant?: 'inline' | 'full';
  className?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTodayStr(): string {
  return deviceDayString();
}

function isFuture(dateStr: string): boolean {
  return dateStr > getTodayStr();
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ConsistencyGrid({ last30, onBackfill, variant = 'inline', className }: ConsistencyGridProps) {
  const { t } = useTranslation();
  const { language } = useAppStore();
  const mounted = useHasMounted();
  const reduceRaw = useReducedMotion() ?? false;
  const prm = mounted && reduceRaw;

  const todayStr = getTodayStr();

  // Inline: last 14 entries; full: all 30
  const entries = variant === 'inline' ? last30.slice(-14) : last30;

  const dateFormatter = new Intl.DateTimeFormat(
    language === 'bn' ? 'bn-BD' : undefined,
    { month: 'short', day: 'numeric' }
  );

  function getCellLabel(entry: ConsistencyEntry): string {
    const dateStr = dateFormatter.format(new Date(entry.date + 'T00:00:00'));
    if (entry.date === todayStr) return t('consistency.cellLabel', { date: dateStr, status: t('consistency.today') });
    if (entry.logged) return t('consistency.cellLabel', { date: dateStr, status: t('consistency.logged') });
    return t('consistency.cellLabel', { date: dateStr, status: t('consistency.missed') });
  }

  function renderDot(entry: ConsistencyEntry, index: number) {
    const isToday = entry.date === todayStr;
    const isFutureDate = isFuture(entry.date);
    const isBackfillable = !isToday && !isFutureDate && !entry.logged;
    const label = getCellLabel(entry);

    const dotBase =
      'rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--goal-accent,var(--color-primary))]';

    const dotSize = variant === 'inline' ? 'w-3 h-3' : 'w-4 h-4 sm:w-5 sm:h-5';

    const dotStyle: React.CSSProperties = {
      backgroundColor: entry.logged
        ? 'var(--goal-accent, var(--color-primary))'
        : isToday
          ? 'transparent'
          : 'var(--color-border)',
      border: isToday
        ? '2px solid var(--goal-accent, var(--color-primary))'
        : entry.logged
          ? 'none'
          : '1.5px solid var(--color-border)',
      opacity: isFutureDate ? 0.3 : 1,
    };

    if (isBackfillable) {
      return prm ? (
        <button
          key={entry.date}
          onClick={() => onBackfill(entry.date)}
          aria-label={label}
          className={`${dotSize} ${dotBase} hover:scale-110 active:scale-95`}
          style={dotStyle}
        />
      ) : (
        <motion.button
          key={entry.date}
          onClick={() => onBackfill(entry.date)}
          aria-label={label}
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
          className={`${dotSize} ${dotBase}`}
          style={dotStyle}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.025, type: 'spring', stiffness: 400, damping: 25 }}
        />
      );
    }

    // Non-interactive cell
    return prm ? (
      <div key={entry.date} aria-label={label} title={label} className={`${dotSize} rounded-full`} style={dotStyle} />
    ) : (
      <motion.div
        key={entry.date}
        aria-label={label}
        title={label}
        className={`${dotSize} rounded-full`}
        style={dotStyle}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: isFutureDate ? 0.3 : 1, scale: 1 }}
        transition={{ delay: index * 0.025, type: 'spring', stiffness: 400, damping: 25 }}
      />
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
        <div className="flex items-center gap-1 flex-wrap" role="group" aria-label={t('consistency.last30')}>
          {entries.map((entry, i) => (
            <span key={entry.date}>{renderDot(entry, i)}</span>
          ))}
        </div>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          {t('consistency.tapToLog')}
        </p>
      </div>
    );
  }

  // Full: 7-wide grid (weeks)
  // Pad front so first day of the 30-window lands on the correct weekday slot
  const firstDate = entries[0] ? new Date(entries[0].date + 'T00:00:00') : new Date();
  const startDow = firstDate.getDay(); // 0=Sun
  const padCells = Array.from({ length: startDow });

  return (
    <div className={`flex flex-col gap-2 ${className ?? ''}`}>
      <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
        {t('consistency.last30')}
      </p>
      {/* DOW headers */}
      <div className="grid grid-cols-7 gap-1 mb-0.5" aria-hidden="true">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <span key={i} className="text-[11px] text-center font-bold text-[var(--color-text-muted)] uppercase">{d}</span>
        ))}
      </div>
      <div
        className="grid grid-cols-7 gap-1.5 sm:gap-2"
        role="group"
        aria-label={t('consistency.last30')}
      >
        {padCells.map((_, i) => <div key={`pad-${i}`} />)}
        {entries.map((entry, i) => (
          <div key={entry.date} className="flex items-center justify-center">
            {renderDot(entry, i)}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-1">
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--goal-accent, var(--color-primary))' }} aria-hidden="true" />
          {t('consistency.logged')}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
          <span className="w-2.5 h-2.5 rounded-full border border-[var(--color-border)]" aria-hidden="true" />
          {t('consistency.missed')}
        </span>
      </div>
      <p className="text-[11px] text-[var(--color-text-muted)]">
        {t('consistency.tapToLog')}
      </p>
    </div>
  );
}

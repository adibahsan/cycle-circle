'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isValid,
  parse,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { bn } from 'date-fns/locale/bn';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import '@vesta/shared/utils/i18n';

interface DatePickerProps {
  /** `yyyy-MM-dd` (same shape as a native date input value). */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  'aria-label'?: string;
  /** Earliest selectable day (inclusive). */
  minDate?: Date;
  /** Latest selectable day (inclusive). */
  maxDate?: Date;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const VALUE_FMT = 'yyyy-MM-dd';

function parseValue(value: string): Date | null {
  if (!value) return null;
  const d = parse(value.trim(), VALUE_FMT, new Date());
  return isValid(d) ? d : null;
}

export function DatePicker({
  value,
  onChange,
  id,
  'aria-label': ariaLabel,
  minDate,
  maxDate,
  placeholder = 'YYYY-MM-DD',
  disabled,
  className,
}: DatePickerProps) {
  const { t } = useTranslation();
  const { language } = useAppStore();
  const dateLocale = language === 'bn' ? bn : undefined;

  const reactId = useId();
  const pickerId = id ?? `dp-${reactId}`;

  const selected = useMemo(() => parseValue(value), [value]);

  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [viewMonth, setViewMonth] = useState<Date>(
    () => startOfMonth(selected ?? maxDate ?? new Date())
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputFocused = useRef(false);

  // Mirror external value changes (e.g. calendar clicks) into the input —
  // but never while the user is mid-typing.
  useEffect(() => {
    if (!inputFocused.current) setText(value);
  }, [value]);

  useEffect(() => {
    if (selected) setViewMonth(startOfMonth(selected));
  }, [selected]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function handlePointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const minDay = minDate ? startOfDay(minDate) : null;
  const maxDay = maxDate ? startOfDay(maxDate) : null;

  const gridDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [viewMonth]);

  const DOW = [
    t('calendar.sun'),
    t('calendar.mon'),
    t('calendar.tue'),
    t('calendar.wed'),
    t('calendar.thu'),
    t('calendar.fri'),
    t('calendar.sat'),
  ];

  const today = new Date();

  function isDisabledDay(day: Date) {
    const d = startOfDay(day);
    if (minDay && d < minDay) return true;
    if (maxDay && d > maxDay) return true;
    return false;
  }

  function handleTextChange(raw: string) {
    setText(raw);
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange('');
      return;
    }
    const d = parseValue(trimmed);
    if (d && !isDisabledDay(d)) onChange(format(d, VALUE_FMT));
  }

  function handleBlur() {
    inputFocused.current = false;
    const trimmed = text.trim();
    if (!trimmed) {
      onChange('');
      return;
    }
    const d = parseValue(trimmed);
    // Normalise valid input; revert anything unparseable/out-of-range.
    setText(d && !isDisabledDay(d) ? format(d, VALUE_FMT) : value);
  }

  function pickDay(day: Date) {
    onChange(format(day, VALUE_FMT));
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div ref={rootRef} className={className}>
      {/* Manual-entry input + calendar toggle */}
      <div
        className={`flex w-full items-center gap-2 rounded-xl border bg-[var(--color-bg-secondary)] pl-4 pr-1.5 py-1 transition-colors transition-shadow duration-200 focus-within:ring-2 focus-within:ring-[var(--goal-accent)]/30 focus-within:border-[var(--goal-accent)] ${
          open ? 'border-[var(--goal-accent)]' : 'border-[var(--color-border)]'
        } ${disabled ? 'opacity-60' : ''}`}
      >
        <input
          ref={inputRef}
          id={pickerId}
          type="text"
          inputMode="numeric"
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onFocus={() => {
            inputFocused.current = true;
          }}
          onBlur={handleBlur}
          placeholder={placeholder}
          aria-label={ariaLabel}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          className="flex-1 bg-transparent py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none disabled:cursor-not-allowed"
        />
        <button
          type="button"
          aria-label={open ? t('calendar.closeCalendar') : t('calendar.openCalendar')}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={`${pickerId}-dialog`}
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={`shrink-0 rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card)] hover:text-[var(--goal-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]/30 transition-colors disabled:cursor-not-allowed ${
            open ? 'bg-[var(--color-bg-card)] text-[var(--goal-accent)]' : ''
          }`}
        >
          <CalendarDays size={18} aria-hidden="true" />
        </button>
      </div>

      {/* Inline calendar (expands within the sheet so it never clips on scroll) */}
      {open && (
        <div
          id={`${pickerId}-dialog`}
          role="dialog"
          aria-modal="false"
          aria-label={t('calendar.chooseDate')}
          className="mt-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 shadow-soft"
        >
          {/* Month nav */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              aria-label={t('calendar.previousMonth') || 'Previous month'}
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              className="rounded-xl p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--goal-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]/40 transition-colors"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <span className="text-sm font-bold text-[var(--color-text-primary)]">
              {format(viewMonth, 'MMMM yyyy', { locale: dateLocale })}
            </span>
            <button
              type="button"
              aria-label={t('calendar.nextMonth') || 'Next month'}
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="rounded-xl p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--goal-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]/40 transition-colors"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DOW.map((d, i) => (
              <div key={`${d}-${i}`} className="flex items-center justify-center">
                <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                  {d}
                </span>
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {gridDays.map((day) => {
              const inMonth = isSameMonth(day, viewMonth);
              const isSelected = selected ? isSameDay(day, selected) : false;
              const isToday = isSameDay(day, today);
              const isDisabled = isDisabledDay(day);
              return (
                <button
                  key={format(day, 'yyyy-MM-dd')}
                  type="button"
                  disabled={isDisabled}
                  aria-pressed={isSelected}
                  onClick={() => pickDay(day)}
                  className="aspect-square flex items-center justify-center rounded-xl text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]/40 disabled:cursor-not-allowed disabled:opacity-30"
                  style={{
                    backgroundColor: isSelected
                      ? 'var(--goal-accent)'
                      : isToday
                        ? 'color-mix(in srgb, var(--goal-accent) 10%, transparent)'
                        : 'transparent',
                    color: isSelected
                      ? '#fff'
                      : isToday
                        ? 'var(--goal-accent)'
                        : inMonth
                          ? 'var(--color-text-primary)'
                          : 'var(--color-text-muted)',
                    fontWeight: isToday || isSelected ? 700 : 500,
                    opacity: !inMonth && !isDisabled ? 0.4 : undefined,
                  }}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

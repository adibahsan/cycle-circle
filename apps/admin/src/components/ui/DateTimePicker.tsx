'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { placePopover, Z_CLASS } from '@vesta/shared/utils/popup-core';
import { popupStack } from '@vesta/shared/utils/popup-runtime';
import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';
import { Select } from './Select';

interface DateTimePickerProps {
  /** `yyyy-MM-ddTHH:mm` (same shape as a native datetime-local value). */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  'aria-label'?: string;
  /** Disable days before this `Date` (time portion ignored). */
  minDate?: Date;
  /** Hint shown in the manual-entry input. */
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Parse `yyyy-MM-ddTHH:mm` (or with a space separator) into a local Date, or null. */
function parseValue(value: string): Date | null {
  if (!value) return null;
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  if (Number.isNaN(date.getTime())) return null;
  // Reject overflow (e.g. month 13, day 32 rolling over).
  if (date.getMonth() !== Number(mo) - 1 || date.getDate() !== Number(d)) return null;
  return date;
}

/** Canonical value string used by the parent. */
function formatValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Human-editable text shown in the input (space separator, no `T`). */
function valueToText(value: string): string {
  return value ? value.replace('T', ' ') : '';
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({ value: pad(i), label: pad(i) }));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => ({ value: pad(i), label: pad(i) }));

export function DateTimePicker({
  value,
  onChange,
  id,
  'aria-label': ariaLabel,
  minDate,
  placeholder = 'YYYY-MM-DD HH:MM',
  disabled,
  className,
}: DateTimePickerProps) {
  const reactId = useId();
  const pickerId = id ?? `dtp-${reactId}`;

  const selected = useMemo(() => parseValue(value), [value]);

  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => valueToText(value));
  const [viewMonth, setViewMonth] = useState<Date>(
    () => startOfDay(selected ?? minDate ?? new Date())
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputFocused = useRef(false);
  const popRef = useRef<HTMLDivElement>(null);
  const idRef = useRef<symbol>(Symbol('date-picker'));
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  // Render inside the enclosing pop-up's root (not clipped by its scrolling body, not inert).
  const [host, setHost] = useState<HTMLElement | null>(null);

  // Mirror external value changes (e.g. calendar clicks) into the input —
  // but never while the user is mid-typing, to avoid clobbering the cursor.
  useEffect(() => {
    if (!inputFocused.current) setText(valueToText(value));
  }, [value]);

  // Keep the visible month aligned with the current selection.
  useEffect(() => {
    if (selected) setViewMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
  }, [selected]);

  // Join the ESC stack while open so ESC closes only the picker, then place it.
  useEffect(() => {
    if (!open) return;
    const id = idRef.current;
    popupStack.push(id);
    setHost(
      (rootRef.current?.closest('[data-popup-root]') as HTMLElement | null) ?? document.body,
    );
    function handlePointer(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && popupStack.isTop(id)) {
        e.stopPropagation();
        setOpen(false);
        inputRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      popupStack.remove(id);
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  // Position against the anchor; follow scroll/resize.
  useEffect(() => {
    if (!open || !host) return;
    function place() {
      const anchor = rootRef.current?.getBoundingClientRect();
      const pop = popRef.current;
      if (!anchor) return;
      setPos(
        placePopover(
          anchor,
          { width: pop?.offsetWidth ?? 320, height: pop?.offsetHeight ?? 380 },
          { width: window.innerWidth, height: window.innerHeight },
        ),
      );
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, host, viewMonth]);

  const minDay = minDate ? startOfDay(minDate) : null;

  // Build the calendar grid (6 weeks) for the visible month.
  const grid = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [viewMonth]);

  function handleTextChange(raw: string) {
    setText(raw);
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange('');
      return;
    }
    const d = parseValue(trimmed);
    if (d) onChange(formatValue(d));
  }

  function handleBlur() {
    inputFocused.current = false;
    const trimmed = text.trim();
    if (!trimmed) {
      onChange('');
      return;
    }
    const d = parseValue(trimmed);
    // Normalise valid input; revert unparseable input to the last good value.
    setText(d ? valueToText(formatValue(d)) : valueToText(value));
  }

  function pickDay(day: Date) {
    const hours = selected ? selected.getHours() : 9;
    const minutes = selected ? selected.getMinutes() : 0;
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
    onChange(formatValue(next));
  }

  function setTime(part: 'h' | 'm', raw: string) {
    const base =
      selected ?? new Date(viewMonth.getFullYear(), viewMonth.getMonth(), viewMonth.getDate(), 9, 0);
    const next = new Date(base);
    if (part === 'h') next.setHours(Number(raw));
    else next.setMinutes(Number(raw));
    onChange(formatValue(next));
  }

  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(viewMonth);

  return (
    <div ref={rootRef} className={clsx('relative w-full', className)}>
      {/* Manual-entry input + calendar toggle */}
      <div
        className={clsx(
          'flex w-full items-center gap-2 rounded-xl border bg-[var(--color-bg-card)] pl-3.5 pr-1.5 py-1',
          'transition-colors transition-shadow duration-200',
          'focus-within:ring-2 focus-within:ring-[var(--color-primary)]/30 focus-within:border-[var(--color-primary)]',
          open ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]',
          disabled && 'opacity-60'
        )}
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
          aria-label={open ? 'Close calendar' : 'Open calendar'}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={`${pickerId}-dialog`}
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={clsx(
            'shrink-0 rounded-lg p-2 text-[var(--color-text-muted)]',
            'hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-primary)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30',
            'transition-colors disabled:cursor-not-allowed',
            open && 'bg-[var(--color-bg-secondary)] text-[var(--color-primary)]'
          )}
        >
          <CalendarClock size={16} aria-hidden="true" />
        </button>
      </div>

      {open && host && createPortal(
        <div
          ref={popRef}
          id={`${pickerId}-dialog`}
          role="dialog"
          aria-modal="false"
          aria-label="Choose date and time"
          style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden', overscrollBehavior: 'contain' }}
          className={clsx(
            `fixed ${Z_CLASS.popover} w-[20rem] max-w-[calc(100vw-1rem)] overscroll-contain`,
            'rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 shadow-lg'
          )}
        >
          {/* Month navigation */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="rounded-lg p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 transition-colors"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              {monthLabel}
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="rounded-lg p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 transition-colors"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="py-1 text-center text-xs font-medium text-[var(--color-text-muted)]"
              >
                {w}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1">
            {grid.map((day) => {
              const inMonth = day.getMonth() === viewMonth.getMonth();
              const isSelected =
                selected &&
                day.getFullYear() === selected.getFullYear() &&
                day.getMonth() === selected.getMonth() &&
                day.getDate() === selected.getDate();
              const isDisabled = minDay ? startOfDay(day) < minDay : false;
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={isDisabled}
                  aria-pressed={!!isSelected}
                  onClick={() => pickDay(day)}
                  className={clsx(
                    'flex h-8 w-full items-center justify-center rounded-lg text-sm tabular-nums',
                    'transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30',
                    isSelected
                      ? 'bg-[var(--color-action)] text-[var(--color-on-action)] font-medium'
                      : inMonth
                        ? 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]'
                        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]',
                    isDisabled && 'opacity-30 cursor-not-allowed hover:bg-transparent'
                  )}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          {/* Time row */}
          <div className="mt-3 flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">Time</span>
            <div className="ml-auto flex items-center gap-1.5">
              <Select
                aria-label="Hour"
                value={selected ? pad(selected.getHours()) : '09'}
                onChange={(v) => setTime('h', v)}
                options={HOUR_OPTIONS}
                selectSize="sm"
                containerClassName="w-auto"
              />
              <span className="text-[var(--color-text-muted)]">:</span>
              <Select
                aria-label="Minute"
                value={selected ? pad(selected.getMinutes()) : '00'}
                onChange={(v) => setTime('m', v)}
                options={MINUTE_OPTIONS}
                selectSize="sm"
                containerClassName="w-auto"
              />
            </div>
          </div>
        </div>,
        host,
      )}
    </div>
  );
}

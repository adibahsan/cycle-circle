'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** Visible label rendered above the control. */
  label?: string;
  /** Accessible name when no visible label is used. */
  'aria-label'?: string;
  id?: string;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  /** `sm` matches inline filter rows, `md` matches form fields. */
  selectSize?: 'sm' | 'md';
  /** Classes applied to the trigger button. */
  className?: string;
  /** Classes applied to the outer wrapper — e.g. `w-auto` for inline rows. */
  containerClassName?: string;
}

export function Select({
  options,
  value,
  onChange,
  label,
  'aria-label': ariaLabel,
  id,
  error,
  disabled,
  placeholder = 'Select…',
  selectSize = 'md',
  className,
  containerClassName,
}: SelectProps) {
  const reactId = useId();
  const selectId = id ?? `select-${reactId}`;
  const listboxId = `${selectId}-listbox`;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function handlePointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointer);
    return () => document.removeEventListener('mousedown', handlePointer);
  }, [open]);

  // When opening, focus the active option and seed it from the selection.
  useEffect(() => {
    if (open) {
      const start = selectedIndex >= 0 ? selectedIndex : 0;
      setActiveIndex(start);
    }
  }, [open, selectedIndex]);

  useEffect(() => {
    if (open && activeIndex >= 0) {
      optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [open, activeIndex]);

  function commit(index: number) {
    const opt = options[index];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function handleButtonKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Enter':
      case ' ':
        e.preventDefault();
        setOpen(true);
        break;
    }
  }

  function handleListKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        commit(activeIndex);
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation(); // closes only the list, not the pop-up around it
        setOpen(false);
        buttonRef.current?.focus();
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  }

  return (
    <div
      ref={rootRef}
      className={clsx('relative w-full', containerClassName)}
    >
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"
        >
          {label}
        </label>
      )}

      <button
        ref={buttonRef}
        type="button"
        id={selectId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleButtonKeyDown}
        className={clsx(
          'flex w-full items-center justify-between gap-2 rounded-xl border bg-[var(--color-bg-card)] text-left',
          'text-[var(--color-text-primary)] cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 focus-visible:border-[var(--color-primary)]',
          'transition-colors transition-shadow duration-200',
          open
            ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/30'
            : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50',
          selectSize === 'sm' ? 'px-3 py-2.5 text-sm' : 'px-4 py-3 text-sm',
          error && 'border-red-400',
          disabled && 'opacity-60 cursor-not-allowed',
          className
        )}
      >
        <span
          className={clsx(
            'truncate',
            !selected && 'text-[var(--color-text-muted)]'
          )}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={clsx(
            'shrink-0 text-[var(--color-text-muted)] transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-activedescendant={
            activeIndex >= 0 ? `${selectId}-opt-${activeIndex}` : undefined
          }
          tabIndex={-1}
          ref={(el) => el?.focus()}
          onKeyDown={handleListKeyDown}
          className={clsx(
            'absolute z-50 mt-1.5 max-h-64 w-full min-w-max overflow-auto overscroll-contain',
            'rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-1.5 shadow-lg',
            'focus:outline-none'
          )}
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            const isActive = i === activeIndex;
            return (
              <li
                key={opt.value}
                id={`${selectId}-opt-${i}`}
                ref={(el) => {
                  optionRefs.current[i] = el;
                }}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => commit(i)}
                className={clsx(
                  'flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm',
                  'transition-colors duration-100',
                  isActive
                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'text-[var(--color-text-secondary)]',
                  isSelected && !isActive && 'text-[var(--color-text-primary)] font-medium'
                )}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && (
                  <Check
                    size={15}
                    aria-hidden="true"
                    className="shrink-0 text-[var(--color-primary)]"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}

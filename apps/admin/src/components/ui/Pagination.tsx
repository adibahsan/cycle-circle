'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  /** Total number of rows across all pages — used to render the range count. */
  total: number;
  /** Optional noun for the count label, e.g. "user" → "143 users". Defaults to "result". */
  itemLabel?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZES = [10, 20, 50, 100];

// Naive pluralization covering the admin item labels: handles consonant + "y" → "ies".
function pluralize(word: string): string {
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

/**
 * Page-size dropdown that always opens *upward*. The native <select> popup
 * picks its own direction, which is jarring inside the bottom-pinned pagination
 * bar — this custom listbox keeps the behavior consistent.
 */
function PageSizeSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (size: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, PAGE_SIZES.indexOf(value))
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // Move DOM focus to the active option while open.
  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  function openMenu() {
    setActiveIndex(Math.max(0, PAGE_SIZES.indexOf(value)));
    setOpen(true);
  }

  function select(size: number) {
    onChange(size);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onButtonKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openMenu();
    }
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => Math.min(PAGE_SIZES.length - 1, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(PAGE_SIZES.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        select(PAGE_SIZES[activeIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        id="page-size-select"
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onButtonKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Rows per page: ${value}`}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-1 text-[var(--color-text-primary)] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)] hover:border-[var(--color-primary)]"
      >
        {value}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={clsx('text-[var(--color-text-muted)] transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Rows per page"
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          className="absolute bottom-full left-0 z-20 mb-1 min-w-full overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] py-1 shadow-soft"
        >
          {PAGE_SIZES.map((size, i) => {
            const selected = size === value;
            return (
              <li
                key={size}
                ref={(el) => {
                  optionRefs.current[i] = el;
                }}
                role="option"
                aria-selected={selected}
                tabIndex={-1}
                onClick={() => select(size)}
                onMouseEnter={() => setActiveIndex(i)}
                className={clsx(
                  'flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-sm tabular-nums outline-none',
                  i === activeIndex
                    ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-secondary)]'
                )}
              >
                {size}
                {selected && <Check size={14} aria-hidden="true" className="text-[var(--color-primary)]" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [1];
  if (current > 3) pages.push('...');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  total,
  itemLabel = 'result',
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const pages = getPageNumbers(currentPage, totalPages);

  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);
  const plural = total === 1 ? itemLabel : pluralize(itemLabel);

  return (
    <div className="sticky bottom-0 z-10 mt-auto -mx-4 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]/85 px-4 py-3 text-sm backdrop-blur-sm sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
      {/* Range count + page size selector */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[var(--color-text-muted)]">
        <p aria-live="polite" className="whitespace-nowrap tabular-nums">
          {total === 0 ? (
            `No ${plural}`
          ) : (
            <>
              Showing{' '}
              <span className="font-medium text-[var(--color-text-secondary)]">
                {start.toLocaleString()}–{end.toLocaleString()}
              </span>{' '}
              of{' '}
              <span className="font-medium text-[var(--color-text-secondary)]">
                {total.toLocaleString()}
              </span>{' '}
              {plural}
            </>
          )}
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="page-size-select" className="whitespace-nowrap">Rows per page:</label>
          <PageSizeSelect value={pageSize} onChange={onPageSizeChange} />
        </div>
      </div>

      {/* Page buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className={clsx(
            'flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors duration-150',
            'hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)]'
          )}
          aria-label="Previous page"
        >
          ‹
        </button>

        {pages.map((page, idx) =>
          page === '...' ? (
            <span
              key={`ellipsis-${idx}`}
              className="flex h-8 w-8 items-center justify-center text-[var(--color-text-muted)]"
            >
              …
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              aria-current={page === currentPage ? 'page' : undefined}
              className={clsx(
                'flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-medium transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)]',
                page === currentPage
                  ? 'border-[var(--color-action)] bg-[var(--color-action)] text-[var(--color-on-action)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]'
              )}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className={clsx(
            'flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors duration-150',
            'hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)]'
          )}
          aria-label="Next page"
        >
          ›
        </button>
      </div>
    </div>
  );
}

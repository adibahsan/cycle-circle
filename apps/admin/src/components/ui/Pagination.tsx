'use client';

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
    <div className="sticky bottom-0 z-10 mt-auto -mx-6 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]/85 px-6 py-3 text-sm backdrop-blur-sm md:-mx-8 md:px-8">
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
          <select
            id="page-size-select"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-1 text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-colors transition-shadow duration-200"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
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
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500'
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
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500',
                page === currentPage
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
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
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500'
          )}
          aria-label="Next page"
        >
          ›
        </button>
      </div>
    </div>
  );
}

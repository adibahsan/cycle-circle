'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { Shimmer } from './Shimmer';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  keyExtractor?: (row: T) => string | number;
}

type SortDirection = 'asc' | 'desc';

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading,
  emptyMessage = 'No data found.',
  onRowClick,
  keyExtractor,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  function handleSort(col: Column<T>) {
    if (!col.sortable) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
  }

  const sortedData = sortKey
    ? [...data].sort((a, b) => {
        const aVal = a[sortKey] as string | number | null | undefined;
        const bVal = b[sortKey] as string | number | null | undefined;
        if (aVal === bVal) return 0;
        if (aVal == null) return sortDir === 'asc' ? 1 : -1;
        if (bVal == null) return sortDir === 'asc' ? -1 : 1;
        const cmp = aVal < bVal ? -1 : 1;
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : data;

  return (
    <div className="w-full overflow-auto rounded-2xl border border-[var(--color-border)] glass">
      <table className="w-full min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                onClick={() => handleSort(col)}
                className={clsx(
                  'sticky top-0 bg-[var(--color-bg-secondary)] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] first:pl-5 last:pr-5',
                  col.sortable && 'cursor-pointer select-none hover:text-[var(--color-text-primary)] transition-colors'
                )}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable && (
                    <span className="flex flex-col leading-none opacity-50">
                      <span
                        className={clsx('text-[10px]', {
                          'opacity-100 text-[var(--color-primary)]':
                            sortKey === col.key && sortDir === 'asc',
                        })}
                      >
                        ▲
                      </span>
                      <span
                        className={clsx('text-[10px]', {
                          'opacity-100 text-[var(--color-primary)]':
                            sortKey === col.key && sortDir === 'desc',
                        })}
                      >
                        ▼
                      </span>
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 first:pl-5 last:pr-5">
                    <Shimmer className="h-4 w-full" />
                  </td>
                ))}
              </tr>
            ))
          ) : sortedData.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-5 py-12 text-center text-[var(--color-text-muted)]"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedData.map((row, idx) => (
              <tr
                key={keyExtractor ? keyExtractor(row) : idx}
                onClick={() => onRowClick?.(row)}
                className={clsx(
                  'border-b border-[var(--color-border)] last:border-0 transition-colors duration-150',
                  'hover:bg-[var(--color-bg-secondary)]',
                  onRowClick && 'cursor-pointer'
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-4 py-3 text-[var(--color-text-primary)] first:pl-5 last:pr-5"
                  >
                    {col.render
                      ? col.render(row)
                      : (row[col.key] as React.ReactNode) ?? null}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
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
  /** When provided, sorting pushes URL params instead of sorting client-side. */
  sortKey?: string | null;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (key: string, order: 'asc' | 'desc') => void;
  /** Opt-in row selection (controlled). Requires `keyExtractor`. Adds a checkbox column + select-all-on-page. */
  selectable?: boolean;
  selectedKeys?: ReadonlySet<string | number>;
  onSelectionChange?: (keys: Set<string | number>) => void;
  /** Accessible name for a row checkbox, e.g. `Select "Title"`. */
  rowSelectLabel?: (row: T) => string;
}

type SortDirection = 'asc' | 'desc';

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading,
  emptyMessage = 'No data found.',
  onRowClick,
  keyExtractor,
  sortKey: controlledSortKey,
  sortOrder: controlledSortOrder,
  onSortChange,
  selectable,
  selectedKeys,
  onSelectionChange,
  rowSelectLabel,
}: DataTableProps<T>) {
  // Internal state used only when onSortChange is not provided (client-side sort)
  const [localSortKey, setLocalSortKey] = useState<string | null>(null);
  const [localSortDir, setLocalSortDir] = useState<SortDirection>('asc');

  const isControlled = typeof onSortChange === 'function';
  const sortKey = isControlled ? (controlledSortKey ?? null) : localSortKey;
  const sortDir = isControlled ? (controlledSortOrder ?? 'asc') : localSortDir;

  function handleSort(col: Column<T>) {
    if (!col.sortable) return;
    if (isControlled) {
      const nextOrder = sortKey === col.key && sortDir === 'asc' ? 'desc' : 'asc';
      onSortChange!(col.key, nextOrder);
    } else {
      if (localSortKey === col.key) {
        setLocalSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setLocalSortKey(col.key);
        setLocalSortDir('asc');
      }
    }
  }

  // Client-side sort is only applied when not controlled (no onSortChange).
  // When controlled, the server is responsible for returning sorted data.
  const sortedData =
    !isControlled && sortKey
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

  const selecting = !!selectable && !!keyExtractor && !!onSelectionChange;
  const pageKeys = selecting ? sortedData.map((r) => keyExtractor!(r)) : [];
  const selectedOnPage = pageKeys.filter((k) => selectedKeys?.has(k)).length;
  const allSelected = pageKeys.length > 0 && selectedOnPage === pageKeys.length;
  const someSelected = selectedOnPage > 0 && !allSelected;
  const headerCheckRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerCheckRef.current) headerCheckRef.current.indeterminate = someSelected;
  }, [someSelected]);

  function toggleAll() {
    const next = new Set(selectedKeys);
    for (const k of pageKeys) {
      if (allSelected) next.delete(k);
      else next.add(k);
    }
    onSelectionChange!(next);
  }

  function toggleRow(key: string | number) {
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange!(next);
  }

  const checkboxClass =
    'h-4 w-4 cursor-pointer rounded border-[var(--color-border)] accent-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]';
  const colCount = columns.length + (selecting ? 1 : 0);

  return (
    <div className="w-full overflow-auto rounded-2xl border border-[var(--color-border)] glass">
      <table className="w-full min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            {selecting && (
              <th scope="col" style={{ width: '44px' }} className="sticky top-0 bg-[var(--color-bg-secondary)] py-3 pl-5 pr-2 text-left">
                <input
                  ref={headerCheckRef}
                  type="checkbox"
                  className={checkboxClass}
                  aria-label="Select all rows on this page"
                  checked={allSelected}
                  disabled={loading || pageKeys.length === 0}
                  onChange={toggleAll}
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className="sticky top-0 bg-[var(--color-bg-secondary)] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] first:pl-5 last:pr-5"
              >
                {col.sortable ? (
                  <button
                    onClick={() => handleSort(col)}
                    className="inline-flex items-center gap-1 select-none hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
                  >
                    {col.header}
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
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1">{col.header}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                {selecting && <td className="py-3 pl-5 pr-2" />}
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
                colSpan={colCount}
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
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row); } } : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'button' : undefined}
                className={clsx(
                  'border-b border-[var(--color-border)] last:border-0 transition-colors duration-150',
                  'hover:bg-[var(--color-bg-secondary)]',
                  onRowClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]'
                )}
              >
                {selecting && (
                  <td
                    className="py-3 pl-5 pr-2"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className={checkboxClass}
                      aria-label={rowSelectLabel ? rowSelectLabel(row) : 'Select row'}
                      checked={!!selectedKeys?.has(keyExtractor!(row))}
                      onChange={() => toggleRow(keyExtractor!(row))}
                    />
                  </td>
                )}
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

'use client';

import { useEffect, useRef, useState } from 'react';
import { Select } from './Select';

const SEARCH_DEBOUNCE_MS = 300;

interface FilterOption {
  value: string;
  label: string;
}

interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
  filters?: FilterConfig[];
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search…',
  showSearch = true,
  filters,
}: FilterBarProps) {
  // Keep typing instant; only notify the parent (which may hit the server) after a pause.
  const [draft, setDraft] = useState(searchValue);
  const lastEmitted = useRef(searchValue);
  const onChangeRef = useRef(onSearchChange);
  onChangeRef.current = onSearchChange;

  // Adopt external changes (e.g. back/forward navigation, cleared filters).
  useEffect(() => {
    if (searchValue !== lastEmitted.current) {
      lastEmitted.current = searchValue;
      setDraft(searchValue);
    }
  }, [searchValue]);

  useEffect(() => {
    if (draft === lastEmitted.current) return;
    const t = setTimeout(() => {
      lastEmitted.current = draft;
      onChangeRef.current(draft);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [draft]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search input */}
      {showSearch && (
        <div className="relative flex-1 min-w-[200px]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Search"
            name="search"
            autoComplete="off"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] py-2.5 pl-9 pr-4 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-colors transition-shadow duration-200"
          />
        </div>
      )}

      {/* Filter selects — always right-aligned so their position stays fixed
          across tabs, whether or not the search box is shown. */}
      {filters && filters.length > 0 && (
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {filters.map((filter) => (
            <div key={filter.key} className="flex items-center gap-2">
              <label
                htmlFor={`filter-${filter.key}`}
                className="text-sm text-[var(--color-text-muted)] whitespace-nowrap"
              >
                {filter.label}:
              </label>
              <Select
                id={`filter-${filter.key}`}
                value={filter.value}
                onChange={filter.onChange}
                options={filter.options}
                selectSize="sm"
                containerClassName="w-auto"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { csvFileName } from '@vesta/shared/utils/csv'
import { downloadCsv, useRangeKey } from '@/lib/download-csv'
import { useToast } from '@/components/ui/Toast'

interface CsvExportButtonProps {
  /** Names the file: `<panel>_<range>.csv`. */
  panel: string
  /**
   * Builds the CSV. A table passes a server action result (which also says which range it used);
   * a chart builds it from the rows it already shows. Both cover the range in the URL.
   */
  getCsv: () => string | { csv: string; rangeKey: string } | Promise<string | { csv: string; rangeKey: string }>
  className?: string
}

/**
 * One CSV download for one chart or table. Add it next to any panel title:
 * `<CsvExportButton panel="Signups" getCsv={() => chartToCsv(rows, 'date', 'Date', series)} />`.
 */
export function CsvExportButton({ panel, getCsv, className }: CsvExportButtonProps) {
  const rangeKey = useRangeKey()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function onClick() {
    setBusy(true)
    try {
      const out = await getCsv()
      const csv = typeof out === 'string' ? out : out.csv
      const key = typeof out === 'string' ? rangeKey() : out.rangeKey
      downloadCsv(csv, csvFileName(panel, key))
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={`Export ${panel} as CSV`}
      className={[
        'inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs font-semibold',
        'text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)] disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1',
        className ?? '',
      ].join(' ')}
    >
      <Download size={12} aria-hidden="true" />
      {busy ? 'Exporting…' : 'CSV'}
    </button>
  )
}

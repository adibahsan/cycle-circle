'use client'

import { useSearchParams } from 'next/navigation'
import { exportTableCsv } from '@/app/actions/export-actions'
import { CsvExportButton } from './CsvExportButton'

/**
 * CSV of a whole dashboard table (not just the visible page) for the range and filters in the URL.
 * `table` must be one `exportTableCsv` knows (see `generateTableCsv` in the shared export service).
 */
export function TableCsvExport({ table, panel }: { table: string; panel: string }) {
  const searchParams = useSearchParams()
  return (
    <CsvExportButton
      panel={panel}
      getCsv={() => exportTableCsv(table, Object.fromEntries(searchParams.entries()))}
    />
  )
}

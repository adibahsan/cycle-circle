/**
 * Recompute COVERAGE.md summary tallies from the feature rows and fail if any
 * counted row is still `none` or `look-only` (#133).
 *
 * Usage: pnpm --dir e2e coverage:check
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const COVERAGE = path.join(ROOT, 'COVERAGE.md')

type Depth = 'none' | 'look-only' | 'partial' | 'full' | 'deep'

interface Row {
  section: string
  id: string
  depth: Depth
  line: number
}

const DEPTHS = new Set(['none', 'look-only', 'partial', 'full', 'deep'])

/** Map `deep` → `full` for summary buckets (admin tickets use "deep" as full+). */
function bucket(d: Depth): 'none' | 'look-only' | 'partial' | 'full' {
  if (d === 'deep') return 'full'
  return d
}

function parseRows(md: string): Row[] {
  const lines = md.split('\n')
  const rows: Row[] = []
  let section = ''
  let inServerOnly = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (/^## Server-only/.test(line)) {
      inServerOnly = true
      section = 'Server-only'
      continue
    }
    if (/^### /.test(line)) {
      section = line.replace(/^### /, '').trim()
      continue
    }
    // Feature rows: | W01 | … | full | #120 |
    // or | A01 | … | deep (…) | #126 |
    // or | S01 | … | full | #132 |
    const m = line.match(
      /^\|\s*((?:W|A|S)\d+)\s*\|(?:[^|]*\|){3}\s*(none|look-only|partial|full|deep)(?:\s|\(|\|)/,
    )
    if (!m) continue
    const id = m[1]!
    const depth = m[2] as Depth
    if (!DEPTHS.has(depth)) continue
    // Skip summary table rows that somehow match
    if (section.startsWith('Summary') || section === '') continue
    rows.push({ section: inServerOnly ? 'Server-only' : section, id, depth, line: i + 1 })
  }
  return rows
}

function areaKey(section: string): string {
  if (section.startsWith('Web:')) return section
  if (section.startsWith('Admin:')) return section
  if (section === 'Server-only') return 'Server-only (not counted)'
  return section
}

function main(): void {
  const md = fs.readFileSync(COVERAGE, 'utf8')
  const rows = parseRows(md)
  if (rows.length === 0) {
    console.error('coverage-check: no feature rows parsed from COVERAGE.md')
    process.exit(1)
  }

  const gaps = rows.filter((r) => r.depth === 'none' || r.depth === 'look-only')
  const byArea = new Map<string, { features: number; none: number; lookOnly: number; partial: number; full: number }>()

  for (const r of rows) {
    if (r.section === 'Server-only') continue // tallied separately / not in 63+21
    const key = areaKey(r.section)
    const cur = byArea.get(key) ?? { features: 0, none: 0, lookOnly: 0, partial: 0, full: 0 }
    cur.features++
    const b = bucket(r.depth)
    if (b === 'none') cur.none++
    else if (b === 'look-only') cur.lookOnly++
    else if (b === 'partial') cur.partial++
    else cur.full++
    byArea.set(key, cur)
  }

  const webRows = rows.filter((r) => r.id.startsWith('W'))
  const adminRows = rows.filter((r) => r.id.startsWith('A'))
  const serverRows = rows.filter((r) => r.id.startsWith('S'))

  const tally = (rs: Row[]) => {
    const t = { features: rs.length, none: 0, lookOnly: 0, partial: 0, full: 0 }
    for (const r of rs) {
      const b = bucket(r.depth)
      if (b === 'none') t.none++
      else if (b === 'look-only') t.lookOnly++
      else if (b === 'partial') t.partial++
      else t.full++
    }
    return t
  }

  console.log(`Parsed ${rows.length} feature rows (W=${webRows.length} A=${adminRows.length} S=${serverRows.length})`)
  console.log('Web:', tally(webRows))
  console.log('Admin:', tally(adminRows))
  console.log('Server-only:', tally(serverRows))
  console.log('By section:')
  for (const [k, v] of byArea) {
    console.log(`  ${k}: features=${v.features} none=${v.none} look-only=${v.lookOnly} partial=${v.partial} full=${v.full}`)
  }

  if (gaps.length > 0) {
    console.error('\ncoverage-check FAILED: rows still at none or look-only:')
    for (const g of gaps) {
      console.error(`  L${g.line} ${g.id} (${g.section}) depth=${g.depth}`)
    }
    process.exit(1)
  }

  console.log('\ncoverage-check OK: no none/look-only rows')
}

main()

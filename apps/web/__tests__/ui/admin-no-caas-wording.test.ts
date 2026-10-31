import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// User-facing admin text never says CaaS/CAAS (#205). Internal identifiers keep the name:
// `caas-check`, `TRIGGER_CRON_CAAS_CHECK`, `triggerCaasCheck`, `caasTransactions` are joined to
// other word characters, so only a standalone word counts as wording.
const STANDALONE_CAAS = /(?<![\w-])caas(?![\w-])/i

const ADMIN_SRC = join(__dirname, '../../../admin/src')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return sourceFiles(p)
    return /\.(ts|tsx)$/.test(name) ? [p] : []
  })
}

describe('admin wording', () => {
  it('the matcher flags wording but not identifiers', () => {
    expect(STANDALONE_CAAS.test('BDApps CAAS')).toBe(true)
    expect(STANDALONE_CAAS.test('Run the CaaS check')).toBe(true)
    for (const ok of ["slug: 'caas-check'", 'TRIGGER_CRON_CAAS_CHECK', 'triggerCaasCheck', 'activeSub.caasTransactions']) {
      expect(STANDALONE_CAAS.test(ok), ok).toBe(false)
    }
  })

  it('no admin source file says CaaS/CAAS', () => {
    const hits = sourceFiles(ADMIN_SRC).flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .flatMap((line, i) => (STANDALONE_CAAS.test(line) ? [`${f}:${i + 1}: ${line.trim()}`] : [])),
    )
    expect(hits).toEqual([])
  })
})

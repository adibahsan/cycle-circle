import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  path.resolve(__dirname, '../../../../apps/admin/src/app/(admin)/sms/CreateBroadcastModal.tsx'),
  'utf8',
)

describe('SMS composer state', () => {
  it('starts fresh per open via a keyed child, not a reset effect that re-keys live fields', () => {
    expect(src).not.toMatch(/useEffect/)
    expect(src).toMatch(/<ComposerForm\s+key=\{session\}/)
  })

  it('refuses through the returned { error }, shown in a role=alert region', () => {
    expect(src).toMatch(/'error' in res/)
    expect(src).toMatch(/role="alert"/)
  })
})

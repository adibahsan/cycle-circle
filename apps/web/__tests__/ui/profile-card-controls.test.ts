import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

const src = fs.readFileSync(
  path.resolve(__dirname, '../../src/app/(main)/profiles/ProfilesClient.tsx'),
  'utf8',
)
const start = src.indexOf('function ProfileCard(')
const end = src.indexOf('// ─── Add Profile Form')
const card = src.slice(start, end)

describe('profile card controls (#33)', () => {
  it('locates the ProfileCard source', () => {
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  it('never nests interactive elements', () => {
    let depth = 0
    let maxDepth = 0
    for (const m of card.matchAll(/<(\/?)(button|a)\b/g)) {
      depth += m[1] ? -1 : 1
      maxDepth = Math.max(maxDepth, depth)
    }
    expect(depth).toBe(0)
    expect(maxDepth).toBe(1)
  })

  it('has separate switch, edit and delete buttons, each labelled', () => {
    const buttons = [...card.matchAll(/<button\b/g)]
    expect(buttons).toHaveLength(3)
    const labels = [...card.matchAll(/aria-label=\{([^}]*)\}/g)].map((m) => m[1])
    expect(labels.some((l) => l.includes('profiles.switchTo'))).toBe(true)
    expect(labels.some((l) => l.includes('profiles.editProfile'))).toBe(true)
    expect(labels.some((l) => l.includes('common.delete'))).toBe(true)
  })

  it('has no hardcoded English aria-label', () => {
    expect(card).not.toMatch(/aria-label=\{`Edit /)
  })
})

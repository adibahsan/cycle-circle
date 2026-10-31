import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// DB-backed test files run in parallel on one database, and User.phone is unique: two files
// creating the same literal phone fail at random (seen between #185 and #219). Each file needs
// its own numbers. See __tests__/REVIEW.md.
const ROOT = resolve(__dirname, '..')
const PHONE = /\+8801\d{9}/g
const USES_DB = /from ['"](?:\.\.\/)+helpers\/test-db['"]|new PrismaClient\(/

function testFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return testFiles(p)
    return /\.test\.tsx?$/.test(name) ? [p] : []
  })
}

describe('DB-backed test files', () => {
  it('never share a hard-coded phone number', () => {
    const owners = new Map<string, Set<string>>()
    for (const file of testFiles(ROOT)) {
      const src = readFileSync(file, 'utf-8')
      if (!USES_DB.test(src)) continue
      for (const phone of new Set(src.match(PHONE) ?? [])) {
        const set = owners.get(phone) ?? new Set<string>()
        set.add(relative(ROOT, file))
        owners.set(phone, set)
      }
    }
    const shared = [...owners].filter(([, files]) => files.size > 1).map(([phone, files]) => `${phone}: ${[...files].join(', ')}`)
    expect(shared).toEqual([])
  })
})

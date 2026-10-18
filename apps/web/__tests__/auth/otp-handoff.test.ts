import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../../src', p), 'utf8')

describe('login -> OTP -> dashboard hand-off', () => {
  it('login prefetches /verify-otp', () => {
    expect(read('app/(auth)/login/page.tsx')).toContain("router.prefetch('/verify-otp')")
  })

  it('verify page prefetches the target after success and has no 700ms delay', () => {
    const src = read('app/(auth)/verify-otp/page.tsx')
    expect(src).toContain("router.prefetch(next, { kind: 'full' as PrefetchKind })")
    expect(src).not.toMatch(/setTimeout\(res, 700\)/)
    expect(src).toMatch(/setTimeout\(res, 400\)/)
    expect(src.indexOf("router.prefetch(next, { kind: 'full' as PrefetchKind })")).toBeGreaterThan(src.indexOf('!res.ok'))
    expect(src).toContain('auth.openingDashboard')
    expect(src).toContain('auth.openingSetup')
  })

  it('verify-otp has a loading skeleton', () => {
    expect(read('app/(auth)/verify-otp/loading.tsx')).toContain('Shimmer')
  })
})

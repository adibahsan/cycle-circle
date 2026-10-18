import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '../../src')
const read = (p: string) => fs.readFileSync(path.join(SRC, p), 'utf8')

describe('active-profile cookie sync', () => {
  it('page computes profileCookieSynced and passes it down', () => {
    const s = read('app/(main)/dashboard/page.tsx')
    // A missing cookie with the default (first) profile counts as synced: no action on first visit.
    expect(s).toMatch(/profiles\.some\(\(p\) => p\.id === cookieId\) \? cookieId : profiles\[0\]\.id/)
    expect(s).toContain('savedProfileId === profileId')
    expect(s).toContain('profileCookieSynced={profileCookieSynced}')
    expect(s).toMatch(/Promise\.all\(\[getCurrentUser\(\), getProfiles\(\)\]\)/)
  })
  it('client only calls the cookie action when not synced', () => {
    const s = read('app/(main)/dashboard/DashboardClient.tsx')
    expect(s).toMatch(/profileCookieSynced: boolean/)
    expect(s).toMatch(/if \(!profileCookieSynced\) setActiveProfileCookie\(profile\.id\)/)
  })
  it('action returns early before auth when cookie already matches', () => {
    const s = read('app/actions/profile-actions.ts')
    const body = s.slice(s.indexOf('export async function setActiveProfileCookie'))
    const guard = body.indexOf("=== profileId) return")
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(body.indexOf('requireAuth()'))
  })
})

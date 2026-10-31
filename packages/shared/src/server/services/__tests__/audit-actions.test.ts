import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AUDIT_ACTIONS, AUDIT_ACTION_VALUES, auditActionLabel } from '../audit-actions'

const servicesDir = join(__dirname, '..')

describe('audit action names', () => {
  it('include the actions the filter used to miss', () => {
    expect(AUDIT_ACTION_VALUES).toEqual(
      expect.arrayContaining(['USER_SUSPENDED', 'USER_REACTIVATED', 'USER_DELETED', 'USER_RESTORED', 'PRO_GRANTED', 'PRO_REVOKED', 'ARTICLE_CREATED', 'SET_CRON_ENABLED', 'ADMIN_LOGIN', 'ADMIN_LOGIN_FAILED', 'ADMIN_LOGOUT']),
    )
    expect(AUDIT_ACTION_VALUES).not.toContain('SUSPEND_USER')
  })

  it('labels read as words', () => {
    expect(auditActionLabel('USER_SUSPENDED')).toBe('User Suspended')
  })

  it('services write only registered actions (no raw string literals)', () => {
    for (const f of readdirSync(servicesDir).filter((n) => n.endsWith('-service.ts'))) {
      const src = readFileSync(join(servicesDir, f), 'utf8')
      expect(src, f).not.toMatch(/action:\s*'[A-Z_]+'/)
      expect(src, f).not.toMatch(/createAuditLog\(\s*[\w.]+,\s*'/)
    }
    expect(Object.keys(AUDIT_ACTIONS).every((k) => k === AUDIT_ACTIONS[k as keyof typeof AUDIT_ACTIONS])).toBe(true)
  })
})

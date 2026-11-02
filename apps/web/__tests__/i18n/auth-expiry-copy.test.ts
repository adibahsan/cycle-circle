import { describe, it, expect } from 'vitest'
import i18n from '@vesta/shared/utils/i18n'
import { MAGIC_LINK_TTL_MS, OTP_TTL_MS, durationText } from '@vesta/shared/utils/auth-ttl'
import { buildMagicLinkEmailHtml } from '@vesta/shared/server/magic-link-email'

// #256: expiry copy must say what the server enforces. The TTL values themselves are
// pinned in packages/shared/src/utils/__tests__/auth-ttl.test.ts.

function flatten(value: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) flatten(v, prefix ? `${prefix}.${k}` : k, out)
  } else if (typeof value === 'string') {
    out[prefix] = value
  }
  return out
}

describe.each(['en', 'bn'] as const)('auth expiry copy (%s)', (lng) => {
  const t = i18n.getFixedT(lng)

  it('the OTP screen states the OTP TTL', () => {
    expect(t('auth.codeExpiry')).toContain(durationText(OTP_TTL_MS, lng))
  })

  it('the email-login steps state the magic-link TTL', () => {
    expect(t('auth.magicStepValid')).toContain(durationText(MAGIC_LINK_TTL_MS, lng))
  })

  it('the magic-link email states the magic-link TTL', () => {
    const { html } = buildMagicLinkEmailHtml('https://example.test/cb?token=x', lng)
    expect(html).toContain(durationText(MAGIC_LINK_TTL_MS, lng))
  })

  it('claims no app-level encryption we do not have', () => {
    const bundle = flatten(i18n.getResourceBundle(lng, 'translation'))
    const offenders = Object.entries(bundle).filter(([, v]) => /AES/.test(v)).map(([k]) => k)
    expect(offenders).toEqual([])
  })
})

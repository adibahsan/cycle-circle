import { describe, it, expect, beforeAll } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import i18n from '@vesta/shared/utils/i18n'
import { ContactBlock } from '@/components/legal/ContactBlock'

const SRC = resolve(__dirname, '../../src')

describe.each(['en', 'bn'] as const)('ContactBlock (%s)', (lng) => {
  let html = ''
  beforeAll(async () => {
    await i18n.changeLanguage(lng)
    html = renderToStaticMarkup(createElement(ContactBlock, { showHeading: true }))
  })

  it('renders mailto, tel and plain-text address', () => {
    expect(html).toContain('href="mailto:info@cycle-circle.com"')
    expect(html).toContain('href="tel:+8801810204718"')
    expect(html).toContain('AWR U Tower, Plot 35, Road 133, Gulshan 1, Dhaka 1212')
    expect(html).not.toMatch(/href="[^"]*AWR/)
  })

  it('renders the localized heading and labels', () => {
    expect(html).toContain(i18n.t('contactInfo.heading'))
    expect(html).toContain(i18n.t('contactInfo.emailLabel'))
  })
})

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(f)) out.push(p)
  }
  return out
}

describe('marketing + legal files', () => {
  const files = [
    ...walk(join(SRC, 'app/(marketing)')),
    ...walk(join(SRC, 'components/legal')),
  ]

  it('contain no raw hex colours', () => {
    for (const f of files) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    }
  })

  it('footer and legal pages reuse ContactBlock', () => {
    for (const rel of [
      'app/(marketing)/welcome/sections/LandingFooter.tsx',
      'app/(marketing)/privacy/page.tsx',
      'app/(marketing)/terms/page.tsx',
    ]) {
      expect(readFileSync(join(SRC, rel), 'utf8'), rel).toContain('ContactBlock')
    }
  })
})

import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

const APPS = path.resolve(__dirname, '../../..')

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === 'node_modules' || e.name === '.next') return []
    const p = path.join(dir, e.name)
    return e.isDirectory() ? walk(p) : [p]
  })
}
const tsx = (app: string) =>
  walk(path.join(APPS, app, 'src')).filter((f) => f.endsWith('.tsx') && !f.includes('/internal/'))
const read = (f: string) => fs.readFileSync(f, 'utf8')

describe('review fixes', () => {
  it('never pairs text-white with gradient-primary or a primary fill', () => {
    const bad: string[] = []
    for (const f of [...tsx('web'), ...tsx('admin')])
      for (const line of read(f).split('\n'))
        if (/text-white/.test(line) && /gradient-primary|bg-\[var\(--color-primary\)\]/.test(line)) bad.push(f)
    expect(bad).toEqual([])
  })

  it('BrandLogo adds its light backplate only under dark:', () => {
    const src = read(path.join(APPS, 'web/src/components/ui/BrandLogo.tsx'))
    expect(src).toMatch(/dark:bg-\[#FFF7F8\]/)
    expect(src).not.toMatch(/(?<!dark:)bg-\[#FFF7F8\]/)
  })

  it('renders the full logo only through BrandLogo', () => {
    const offenders = tsx('web').filter(
      (f) => !f.endsWith('BrandLogo.tsx') && read(f).includes('/brand/cycle-circle-logo.svg'),
    )
    expect(offenders).toEqual([])
  })

  it('has no focus:ring in the touched auth/admin files', () => {
    const files = [
      'web/src/app/(auth)/login/page.tsx',
      'web/src/app/(auth)/verify-otp/page.tsx',
      'web/src/app/(auth)/email-login/page.tsx',
      'admin/src/app/(admin)/content/ContentClient.tsx',
    ]
    for (const f of files) expect(read(path.join(APPS, f))).not.toMatch(/(?<![-\w])focus:(ring|border|outline)/)
  })

  it('does not nest a button inside the calendar day button', () => {
    const src = read(path.join(APPS, 'web/src/app/(main)/calendar/CalendarClient.tsx'))
    const cell = src.slice(src.indexOf('const DayCell'), src.indexOf('// ─── Day Detail'))
    const open = cell.indexOf('<button')
    const close = cell.indexOf('</button>', open)
    expect(cell.slice(open + 8, close)).not.toContain('<button')
  })
})

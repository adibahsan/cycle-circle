import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '../../src')
const read = (p: string) => fs.readFileSync(path.join(SRC, p), 'utf8')
const exists = (p: string) => fs.existsSync(path.join(SRC, p))

const MIGRATED = [
  'app/(main)/subscription/SubscriptionClient.tsx',
  'app/(main)/profiles/ProfilesClient.tsx',
  'app/(main)/settings/SettingsClient.tsx',
  'components/onboarding/AccountControl.tsx',
  'components/modals/LatePeriodFullScreenAlert.tsx',
  'components/TrialExpiredLock.tsx',
  'components/LogoutConfirmModal.tsx',
]

describe('#40 account pop-ups are on the shell', () => {
  it.each(MIGRATED)('%s has no hand-rolled overlay', (f) => {
    const src = read(f)
    expect(src).not.toMatch(/fixed inset-0/)
    expect(src).not.toMatch(/role="(alert)?dialog"/)
  })

  it.each(MIGRATED.filter((f) => f !== 'components/LogoutConfirmModal.tsx'))('%s uses the shell', (f) => {
    const src = read(f)
    expect(/from '@\/components\/(ui\/Modal|LogoutConfirmModal)'/.test(src)).toBe(true)
  })

  it('the trial lock is a non-dismissible lock-layer Modal with no link wrapping a button', () => {
    const src = read('components/TrialExpiredLock.tsx')
    expect(src).toMatch(/layer="lock"/)
    expect(src).toMatch(/dismissible=\{false\}/)
    expect(src).not.toMatch(/<Link[^>]*>\s*<Button/)
    expect(src).not.toMatch(/z-\[\d+\]/)
  })

  it('the late-period alert is a prompt-layer pop-up', () => {
    expect(read('components/modals/LatePeriodFullScreenAlert.tsx')).toMatch(/layer="prompt"/)
  })

  it('the BDApps dialog has a name on every step and a status-only live region', () => {
    const src = read('app/(main)/subscription/SubscriptionClient.tsx')
    expect(src).toMatch(/ariaLabel=\{t\('subscription\.mobileBilling'\)\}/)
    expect(src).not.toMatch(/className="p-6" aria-live/)
    expect(src).toMatch(/role="status" aria-live="polite"/)
  })

  it('the unused date picker and late-period prompt are gone and nothing imports them', () => {
    expect(exists('components/ui/DatePicker.tsx')).toBe(false)
    expect(exists('components/modals/LatePeriodPrompt.tsx')).toBe(false)
    const walk = (d: string): string[] =>
      fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(d, e.name)) : /\.(tsx?|css)$/.test(e.name) ? [path.join(d, e.name)] : [],
      )
    for (const f of walk(SRC)) {
      const s = fs.readFileSync(f, 'utf8')
      expect(s, f).not.toMatch(/ui\/DatePicker|modals\/LatePeriodPrompt/)
    }
  })

  it('the main layout mounts the one shared toast, on the toast layer', () => {
    const layout = read('app/(main)/layout.tsx')
    expect(layout.match(/<ToastProvider>/g)).toHaveLength(1)
    expect(read('components/ui/Toast.tsx')).toMatch(/Z_CLASS\.toast/)
  })
})

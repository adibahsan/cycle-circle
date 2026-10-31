import { describe, it, expect, afterEach, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { celebrationCopy, shouldShowConfetti, TOAST_AFTER_POPUP_MS } from '@/lib/toast-core'

const src = (p: string) => readFileSync(resolve(__dirname, '../../src', p), 'utf8')
const exists = (p: string) => existsSync(resolve(__dirname, '../../src', p))

afterEach(() => vi.useRealTimers())

describe('celebration toast copy', () => {
  it('maps each kind to its translation keys and count', () => {
    expect(celebrationCopy('period')).toMatchObject({ titleKey: 'celebration.periodTitle', bodyKey: 'celebration.periodBody' })
    expect(celebrationCopy('symptom', 3)).toMatchObject({ titleKey: 'celebration.symptomTitle', values: { count: 3 } })
    expect(celebrationCopy('milestone', 7).bodyKey).toBe('celebration.milestoneBody')
    expect(celebrationCopy('streak', 2).titleKey).toBe('celebration.streakTitle')
  })
  it('skips confetti under reduced motion', () => {
    expect(shouldShowConfetti(true)).toBe(false)
    expect(shouldShowConfetti(false)).toBe(true)
  })
  it('waits for the pop-up exit animation before showing', () => {
    expect(TOAST_AFTER_POPUP_MS).toBeGreaterThanOrEqual(200)
  })
})

describe('source bans', () => {
  const popups = [
    'components/PeriodLogModal.tsx',
    'components/modals/QuickSymptomModal.tsx',
    'components/engagement/TodayCheckInModal.tsx',
    'components/engagement/ConsistencyGrid.tsx',
    'components/ProfileCompletionModal.tsx',
  ]
  it.each(popups)('%s has no UTC day default', (f) => {
    expect(src(f)).not.toMatch(/toISOString\(\)\.slice\(0,\s*10\)/)
  })
  it.each(['components/PeriodLogModal.tsx', 'components/ProfileCompletionModal.tsx'])('%s is built on the shared shell', (f) => {
    const s = src(f)
    expect(s).toMatch(/from '@\/components\/ui\/Modal'/)
    expect(s).not.toMatch(/fixed inset-0/)
  })
  it('dead components are gone', () => {
    expect(exists('components/ui/DatePicker.tsx')).toBe(false)
    expect(exists('components/modals/LatePeriodPrompt.tsx')).toBe(false)
  })
  it('the celebration is a toast, not a self-closing pop-up', () => {
    expect(exists('components/modals/CelebrationModal.tsx')).toBe(false)
    expect(exists('components/ui/Toast.tsx')).toBe(true)
    const toast = src('components/ui/Toast.tsx')
    expect(toast).toContain('aria-live="polite"')
    expect(toast).toContain('Z_CLASS.toast')
    expect(toast).not.toMatch(/\.focus\(/)
  })
  it('period log no longer auto-closes after a timeout', () => {
    expect(src('components/PeriodLogModal.tsx')).not.toMatch(/setTimeout\(onClose/)
  })
})

describe('period delete (issue 136)', () => {
  const s = src('components/PeriodLogModal.tsx')
  it('offers delete only in edit mode, behind an inline confirm', () => {
    expect(s).toMatch(/deletePeriodLog\(logId\)/)
    expect(s).toMatch(/isEdit && \(/)
    expect(s).toMatch(/confirmingDelete/)
    expect(s).toMatch(/dashboard\.deletePeriodConfirmButton/)
    expect(s).toMatch(/dashboard\.deletePeriodCancel/)
    expect(s).toMatch(/dashboard\.deletePeriodFailed/)
    expect(s).not.toMatch(/window\.confirm|\bconfirm\(/)
  })
})

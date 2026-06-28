import { describe, it, expect } from 'vitest'
import { defaultNotificationPrefsForGoal } from '@vesta/shared/server/services'
import { normalizeGoal, isTTC } from '@vesta/shared/utils/goal'

// FR-NOTIF / FR-SMS (v1.3) goal-based notification filtering.
//
// The filtering is realised by mapping a profile's goal to its default
// NotificationPreference flags (applied on profile create and on goal change).
// The daily-reminders loop gates period/fertile/logging dispatch — for BOTH
// email and Pro SMS — on those flags, so a "conceive" (TTC) profile receives
// fertile-window alerts only. Users can still override via settings toggles.

describe('defaultNotificationPrefsForGoal', () => {
  it('TTC (conceive) → fertile-window only; period + logging suppressed', () => {
    expect(defaultNotificationPrefsForGoal('conceive')).toEqual({
      periodAlert: false,
      fertileWindow: true,
      loggingReminder: false,
    })
  })

  it('pregnancy → all alerts suppressed', () => {
    expect(defaultNotificationPrefsForGoal('pregnancy')).toEqual({
      periodAlert: false,
      fertileWindow: false,
      loggingReminder: false,
    })
  })

  it('perimenopause → period + logging on, fertile off', () => {
    expect(defaultNotificationPrefsForGoal('perimenopause')).toEqual({
      periodAlert: true,
      fertileWindow: false,
      loggingReminder: true,
    })
  })

  it('tracking → all alerts on (the default)', () => {
    expect(defaultNotificationPrefsForGoal('tracking')).toEqual({
      periodAlert: true,
      fertileWindow: true,
      loggingReminder: true,
    })
  })

  it('null / undefined / unknown goal → all alerts on (safe default)', () => {
    const allOn = { periodAlert: true, fertileWindow: true, loggingReminder: true }
    expect(defaultNotificationPrefsForGoal(null)).toEqual(allOn)
    expect(defaultNotificationPrefsForGoal(undefined)).toEqual(allOn)
    expect(defaultNotificationPrefsForGoal('something-else')).toEqual(allOn)
  })

  it('tolerates legacy human-readable goal labels', () => {
    // Older onboarding wrote labels like "Trying to Conceive".
    expect(defaultNotificationPrefsForGoal('Trying to Conceive')).toEqual({
      periodAlert: false,
      fertileWindow: true,
      loggingReminder: false,
    })
  })
})

describe('goal normalization helpers', () => {
  it('normalizeGoal maps canonical ids and legacy labels', () => {
    expect(normalizeGoal('conceive')).toBe('conceive')
    expect(normalizeGoal('Trying to Conceive')).toBe('conceive')
    expect(normalizeGoal('period tracking')).toBe('tracking')
    expect(normalizeGoal('menopause')).toBe('perimenopause')
    expect(normalizeGoal('')).toBeNull()
    expect(normalizeGoal(null)).toBeNull()
  })

  it('isTTC is true only for conceive', () => {
    expect(isTTC('conceive')).toBe(true)
    expect(isTTC('Trying to Conceive')).toBe(true)
    expect(isTTC('tracking')).toBe(false)
    expect(isTTC(null)).toBe(false)
  })
})

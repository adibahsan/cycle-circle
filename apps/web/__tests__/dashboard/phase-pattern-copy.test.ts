import { describe, it, expect } from 'vitest'
import i18n from '@vesta/shared/utils/i18n'

// #75: the Phase pattern describes past logs, never a forecast (GLOSSARY: Phase pattern).
const KEYS = ['patternTitle', 'patternSub', 'patternCount_one', 'patternCount_other', 'patternEmpty', 'patternLogCta']

describe('Phase pattern copy', () => {
  it('has English and Bengali text for every key', () => {
    for (const lng of ['en', 'bn']) {
      for (const key of KEYS) {
        expect(i18n.getResource(lng, 'translation', `dashboard.${key}`), `${lng}.${key}`).toBeTruthy()
      }
    }
  })

  it('makes no forecast or "how you might feel" claims', () => {
    const en = KEYS.map((k) => i18n.getResource('en', 'translation', `dashboard.${k}`)).join(' ')
    expect(en).not.toMatch(/forecast|predict|might feel|will feel|expect/i)
  })

  it('the empty state tells a new user to log symptoms this cycle', () => {
    expect(i18n.getResource('en', 'translation', 'dashboard.patternEmpty')).toBe(
      'Log your symptoms this cycle to see your pattern next time.',
    )
  })
})

// #66 S1: the menopause hero's symptom pattern (no phases, a recent window).
describe('Symptom pattern copy', () => {
  const KEYS = ['symptomPatternTitle', 'symptomPatternSub', 'symptomPatternEmpty']
  it('has English and Bengali text for every key', () => {
    for (const lng of ['en', 'bn']) {
      for (const key of KEYS) {
        expect(i18n.getResource(lng, 'translation', `dashboard.${key}`), `${lng}.${key}`).toBeTruthy()
      }
    }
  })
  it('names the window and makes no phase or forecast claims', () => {
    expect(i18n.t('dashboard.symptomPatternSub', { lng: 'en', n: '90' })).toBe('Most logged in the last 90 days')
    const en = KEYS.map((k) => i18n.getResource('en', 'translation', `dashboard.${k}`)).join(' ')
    expect(en).not.toMatch(/phase|forecast|predict|might feel|will feel|expect/i)
  })
})

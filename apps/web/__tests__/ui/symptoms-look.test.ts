/**
 * Ticket #79: Symptoms in the new look (spec #66, stories 26-30).
 * Rendered behaviour (save errors, chip groups, tabs, no English in Bengali) is guarded by
 * e2e/tests/symptoms-save.spec.ts, e2e/tests/symptoms-look.spec.ts and e2e/tests/bengali-no-english.spec.ts.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import i18n from '@vesta/shared/utils/i18n'
import { CARD_TINTS } from '@/components/ui/Card'
import { CATEGORIES, CATEGORY_TINTS } from '@/components/symptoms/SymptomCategoryTabs'

const SRC = path.resolve(__dirname, '../../src')
const read = (p: string) => fs.readFileSync(path.join(SRC, p), 'utf8')

const PAGE = 'app/(main)/symptoms/SymptomsClient.tsx'
const FILES = [PAGE, 'components/symptoms/SymptomChip.tsx', 'components/symptoms/SymptomCategoryTabs.tsx']

describe('the Symptoms page keeps its name (story 30)', () => {
  for (const lng of ['en', 'bn'] as const) {
    it(`page title matches the nav label in ${lng}`, () => {
      const t = i18n.getFixedT(lng)
      expect(t('symptoms.title')).toBe(t('nav.symptoms'))
    })
  }

  it('the English title reads "Symptoms"', () => {
    expect(i18n.getFixedT('en')('symptoms.title')).toBe('Symptoms')
  })
})

describe('symptom categories are tinted', () => {
  it('every category has its own pastel tint', () => {
    const tints = CATEGORIES.map(({ key }) => CATEGORY_TINTS[key])
    for (const tint of tints) expect(CARD_TINTS).toContain(tint)
    expect(new Set(tints).size).toBe(CATEGORIES.length)
  })
})

describe('symptoms page look', () => {
  for (const file of FILES) {
    it(`${file} uses no gradients and no goal accent`, () => {
      const src = read(file)
      expect(src).not.toContain('linear-gradient')
      expect(src).not.toContain('--goal-accent)')
      expect(src).not.toMatch(/var\(--goal-accent[,)]/)
    })
  }

  it('save buttons are coloured pills in the action colour', () => {
    const src = read(PAGE)
    const saves = src.split('<motion.button').slice(1)
    expect(saves.length).toBeGreaterThanOrEqual(2)
    for (const s of saves) {
      const tag = s.slice(0, s.indexOf('>'))
      expect(tag).toContain('rounded-full')
      expect(tag).toContain('bg-[var(--color-action)]')
    }
  })

  it('the active category sits on a tinted card', () => {
    expect(read('components/symptoms/SymptomCategoryTabs.tsx')).toMatch(/<Card[^>]*tone=\{/)
  })
})

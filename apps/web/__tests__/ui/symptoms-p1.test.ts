/**
 * Ticket #68: Symptoms page, quick-log and Check-in pop-ups — no emoji, no glow shadow,
 * chip labels at least 12px. Rendered behaviour (save errors, groups, tabs) is guarded by
 * e2e/tests/symptoms-save.spec.ts.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { SYMPTOMS_DATA } from '@/lib/symptoms-data'

const SRC = path.resolve(__dirname, '../../src')
const read = (p: string) => fs.readFileSync(path.join(SRC, p), 'utf8')

const FILES = [
  'lib/symptoms-data.ts',
  'app/(main)/symptoms/SymptomsClient.tsx',
  'components/modals/QuickSymptomModal.tsx',
  'components/engagement/TodayCheckInModal.tsx',
  'components/symptoms/SymptomChip.tsx',
  'components/symptoms/SymptomCategoryTabs.tsx',
]

const EMOJI = /\p{Extended_Pictographic}/u

describe('symptom logging surfaces', () => {
  it('every symptom has a drawn icon, not an emoji string', () => {
    for (const s of SYMPTOMS_DATA) {
      expect(typeof s.icon, `${s.id} icon`).not.toBe('string')
      expect(s.icon, `${s.id} icon`).toBeTruthy()
    }
  })

  for (const file of FILES) {
    it(`${file} contains no emoji`, () => {
      const hits = read(file).split('\n').filter((l) => EMOJI.test(l))
      expect(hits).toEqual([])
    })

    it(`${file} has no glow shadow and no sub-12px text`, () => {
      const src = read(file)
      expect(src).not.toContain('shadow-glow')
      expect(src).not.toMatch(/text-\[(?:9|10|11)px\]/)
    })
  }
})

import { describe, it, expect } from 'vitest';
import { getCurrentPhase, getPhaseRanges } from '@vesta/shared/utils/cycle-utils';

const days = (cycleLength: number, periodLength: number) =>
  getPhaseRanges(cycleLength, periodLength).map((r) => [r.phase, r.days]);

describe('getPhaseRanges', () => {
  it('splits a 28-day cycle with a 5-day period into 5 / 4 / 6 / 13 days', () => {
    expect(days(28, 5)).toEqual([
      ['menstrual', 5],
      ['follicular', 4],
      ['ovulation', 6],
      ['luteal', 13],
    ]);
  });

  it('gives each range its first and last cycle day', () => {
    expect(getPhaseRanges(28, 5)).toEqual([
      { phase: 'menstrual', start: 1, end: 5, days: 5 },
      { phase: 'follicular', start: 6, end: 9, days: 4 },
      { phase: 'ovulation', start: 10, end: 15, days: 6 },
      { phase: 'luteal', start: 16, end: 28, days: 13 },
    ]);
  });

  it('gives a 21-day cycle no follicular days instead of a negative count', () => {
    expect(days(21, 5)).toEqual([
      ['menstrual', 5],
      ['follicular', 0],
      ['ovulation', 3],
      ['luteal', 13],
    ]);
  });

  it('lets a long period swallow the follicular and ovulation days', () => {
    expect(days(21, 14)).toEqual([
      ['menstrual', 14],
      ['follicular', 0],
      ['ovulation', 0],
      ['luteal', 7],
    ]);
  });

  for (let cycleLength = 21; cycleLength <= 45; cycleLength++) {
    for (let periodLength = 1; periodLength <= 14; periodLength++) {
      it(`cycle ${cycleLength}, period ${periodLength}: sums to the cycle and matches getCurrentPhase`, () => {
        const ranges = getPhaseRanges(cycleLength, periodLength);
        expect(ranges.reduce((s, r) => s + r.days, 0)).toBe(cycleLength);
        for (const r of ranges) expect(r.days).toBeGreaterThanOrEqual(0);
        for (let day = 1; day <= cycleLength; day++) {
          const owner = ranges.find((r) => r.days > 0 && day >= r.start && day <= r.end);
          expect(owner?.phase).toBe(getCurrentPhase(day, periodLength, cycleLength));
        }
      });
    }
  }
});

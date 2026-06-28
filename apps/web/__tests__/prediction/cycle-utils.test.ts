import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  predictCycleLength,
  getPredictionTier,
  getConfidence,
  getCurrentCycleDay,
  getCurrentPhase,
  getDaysUntilNextPeriod,
  computePrediction,
  normalizeCyclePhase,
  getPhaseColor,
  getPhaseEmoji,
} from '@vesta/shared/utils/cycle-utils';
import type { UserProfile } from '@vesta/shared/types';

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'profile-1',
    userId: 'user-1',
    name: 'Test',
    relation: 'self',
    cycleLength: 28,
    periodLength: 5,
    lastPeriodStart: '2026-01-01',
    cycleHistory: [],
    predictionTier: 'average',
    createdAt: '2026-01-01',
    ...overrides,
  };
}

describe('predictCycleLength', () => {
  it('returns default fallback (28) for empty history', () => {
    expect(predictCycleLength([])).toBe(28);
  });

  it('returns custom fallback for empty history', () => {
    expect(predictCycleLength([], 30)).toBe(30);
  });

  it('returns the single entry without averaging', () => {
    expect(predictCycleLength([30])).toBe(30);
  });

  it('applies weighted average for 2 entries', () => {
    // weights [1, 2], sum = (28*1 + 30*2) / 3 = 88/3 = 29.33 → 29
    expect(predictCycleLength([28, 30])).toBe(29);
  });

  it('applies weighted average for 3 entries', () => {
    // weights [1, 2, 3], sum = (26*1 + 28*2 + 30*3) / 6 = 172/6 = 28.67 → 29
    expect(predictCycleLength([26, 28, 30])).toBe(29);
  });

  it('returns exact value for identical entries', () => {
    expect(predictCycleLength([28, 28, 28, 28, 28, 28])).toBe(28);
  });

  it('gives more weight to recent entries', () => {
    const history = [28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 35];
    // weights 1..12, totalWeight = 78
    // weightedSum = 28*(1+2+3+4+5+6+7+8+9+10+11) + 35*12
    //             = 28*66 + 420 = 1848 + 420 = 2268
    // 2268 / 78 = 29.08 → 29
    const result = predictCycleLength(history);
    expect(result).toBe(29);
    expect(result).toBeGreaterThan(28);
  });
});

describe('getPredictionTier', () => {
  it.each([
    [0, 'average'],
    [1, 'average'],
    [5, 'average'],
    [6, 'arima'],
    [7, 'arima'],
    [100, 'arima'],
  ] as const)('cycleCount %d → %s', (cycleCount, expected) => {
    expect(getPredictionTier(cycleCount)).toBe(expected);
  });
});

describe('getConfidence', () => {
  describe('average tier', () => {
    it.each([
      [0, 40],
      [1, 48],
      [2, 56],
      [3, 64],
      [4, 72],
      [5, 75], // capped at 75 (40 + 40 = 80 exceeds cap)
    ])('cycleCount %d → %d', (cycleCount, expected) => {
      expect(getConfidence('average', cycleCount)).toBe(expected);
    });
  });

  describe('arima tier', () => {
    it.each([
      [6, 82],
      [7, 84],
      [10, 90],
      [11, 92], // capped at 92 (70 + 22 = 92)
      [12, 92],
      [100, 92],
    ])('cycleCount %d → %d', (cycleCount, expected) => {
      expect(getConfidence('arima', cycleCount)).toBe(expected);
    });
  });
});

describe('getCurrentCycleDay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 1 when last period started today', () => {
    expect(getCurrentCycleDay('2026-03-01', 28)).toBe(1);
  });

  it('returns correct day for mid-cycle', () => {
    // 5 days ago → day 6
    expect(getCurrentCycleDay('2026-02-24', 28)).toBe(6);
  });

  it('clamps to cycle length at the exact boundary', () => {
    // 28 days ago → would be day 29; clamped to cycleLength (28).
    // The impl deliberately clamps rather than wrapping, so a late user is
    // never shown a fabricated "day 1" of a cycle they have not logged.
    expect(getCurrentCycleDay('2026-02-01', 28)).toBe(28);
  });

  it('clamps to cycle length past the boundary (late, no new log)', () => {
    // 30 days ago → would be day 31; clamped to cycleLength (28).
    expect(getCurrentCycleDay('2026-01-30', 28)).toBe(28);
  });
});

describe('getCurrentPhase', () => {
  describe('standard cycle (28 days, period 5)', () => {
    const period = 5;
    const cycle = 28;
    // ovulationDay = 28 - 14 = 14
    // follicular: day > 5 AND day < 14 - 4 = 10
    // ovulation: day >= 10 AND day <= 14 + 1 = 15
    // luteal: day > 15

    it.each([
      [1, 'menstrual'],
      [5, 'menstrual'],
      [6, 'follicular'],
      [9, 'follicular'],
      [10, 'ovulation'],
      [14, 'ovulation'],
      [15, 'ovulation'],
      [16, 'luteal'],
      [28, 'luteal'],
    ] as const)('day %d → %s', (day, expected) => {
      expect(getCurrentPhase(day, period, cycle)).toBe(expected);
    });
  });

  describe('short cycle (21 days, period 5)', () => {
    const period = 5;
    const cycle = 21;
    // ovulationDay = 21 - 14 = 7
    // follicular: day > 5 AND day < 7 - 4 = 3 → never true (6 is not < 3)
    // ovulation: day >= 3 AND day <= 7 + 1 = 8
    // With periodLength=5, day 6 is past menstrual but not < 3 for follicular → ovulation

    it('day 6 falls into ovulation window', () => {
      expect(getCurrentPhase(6, period, cycle)).toBe('ovulation');
    });

    it('day 8 is still ovulation', () => {
      expect(getCurrentPhase(8, period, cycle)).toBe('ovulation');
    });

    it('day 9 is luteal', () => {
      expect(getCurrentPhase(9, period, cycle)).toBe('luteal');
    });
  });

  describe('long cycle (35 days, period 5)', () => {
    const period = 5;
    const cycle = 35;
    // ovulationDay = 35 - 14 = 21
    // follicular: day > 5 AND day < 21 - 4 = 17
    // ovulation: day >= 17 AND day <= 21 + 1 = 22

    it('day 16 is follicular', () => {
      expect(getCurrentPhase(16, period, cycle)).toBe('follicular');
    });

    it('day 17 is ovulation', () => {
      expect(getCurrentPhase(17, period, cycle)).toBe('ovulation');
    });

    it('day 22 is ovulation', () => {
      expect(getCurrentPhase(22, period, cycle)).toBe('ovulation');
    });

    it('day 23 is luteal', () => {
      expect(getCurrentPhase(23, period, cycle)).toBe('luteal');
    });
  });
});

describe('getDaysUntilNextPeriod', () => {
  it.each([
    [1, 28, 27],
    [14, 28, 14],
    [28, 28, 0],
  ])('day %d, length %d → %d days remaining', (day, length, expected) => {
    expect(getDaysUntilNextPeriod(day, length)).toBe(expected);
  });
});

describe('computePrediction', () => {
  it('uses fallback cycle length when history is empty', () => {
    const profile = makeProfile({
      cycleHistory: [],
      cycleLength: 28,
      lastPeriodStart: '2026-01-01',
    });

    const result = computePrediction(profile);

    expect(result).toEqual({
      profileId: 'profile-1',
      tier: 'average',
      nextPeriodStart: '2026-01-29',
      ovulationDay: '2026-01-15',
      fertileStart: '2026-01-10',
      fertileEnd: '2026-01-16',
      confidence: 40,
    });
  });

  it('computes weighted prediction with 3 history entries', () => {
    // predictCycleLength([28, 30, 26], 28)
    // weights [1, 2, 3], sum = (28 + 60 + 78) / 6 = 166/6 = 27.67 → 28
    const profile = makeProfile({
      cycleHistory: [28, 30, 26],
      cycleLength: 28,
      lastPeriodStart: '2026-01-01',
    });

    const result = computePrediction(profile);

    expect(result.tier).toBe('average');
    expect(result.confidence).toBe(64);
    expect(result.nextPeriodStart).toBe('2026-01-29');
    expect(result.ovulationDay).toBe('2026-01-15');
  });

  it('uses arima tier with 6 history entries', () => {
    const profile = makeProfile({
      cycleHistory: [28, 28, 28, 28, 28, 28],
      cycleLength: 28,
      lastPeriodStart: '2026-01-01',
    });

    const result = computePrediction(profile);

    expect(result.tier).toBe('arima');
    expect(result.confidence).toBe(82);
  });

  it('returns profileId from the input profile', () => {
    const profile = makeProfile({ id: 'custom-id' });
    expect(computePrediction(profile).profileId).toBe('custom-id');
  });
});

describe('normalizeCyclePhase', () => {
  it('converts ovulatory to ovulation', () => {
    expect(normalizeCyclePhase('ovulatory')).toBe('ovulation');
  });

  it.each(['menstrual', 'follicular', 'ovulation', 'luteal'] as const)(
    'passes %s through unchanged',
    (phase) => {
      expect(normalizeCyclePhase(phase)).toBe(phase);
    },
  );
});

describe('getPhaseColor', () => {
  it.each([
    ['menstrual', 'var(--color-menstrual)'],
    ['follicular', 'var(--color-follicular)'],
    ['ovulation', 'var(--color-ovulation)'],
    ['luteal', 'var(--color-luteal)'],
  ] as const)('%s → %s', (phase, color) => {
    expect(getPhaseColor(phase)).toBe(color);
  });
});

describe('getPhaseEmoji', () => {
  it.each([
    ['menstrual', '\u{1FA78}'],
    ['follicular', '\u{1F331}'],
    ['ovulation', '\u{1F338}'],
    ['luteal', '\u{1F319}'],
  ] as const)('%s → correct emoji', (phase, emoji) => {
    expect(getPhaseEmoji(phase)).toBe(emoji);
  });
});

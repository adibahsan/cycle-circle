import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = resolve(__dirname, '../../src');

function walk(p: string): string[] {
  const abs = join(src, p);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return [abs];
  return readdirSync(abs).flatMap((f) => walk(join(p, f)));
}

// Ticket #23 ownership (see spec #18).
const OWNED = [
  'app/(main)/symptoms',
  'app/(main)/insights',
  'app/(main)/content',
  'app/(main)/learn',
  'app/(main)/settings',
  'app/(main)/profiles',
  'app/(main)/feedback',
  'app/(main)/error.tsx',
  'app/(main)/loading.tsx',
  'app/onboarding',
  'app/get-started',
  'app/error.tsx',
  'app/not-found.tsx',
  'components/engagement/TodayCheckInModal.tsx',
  'components/engagement/StreakBadge.tsx',
  'components/modals',
  'components/ProfileCompletionModal.tsx',
  'components/TrialCountdownPill.tsx',
  'components/TrialExpiredLock.tsx',
  'components/onboarding',
  'components/motion/ParallaxBlobs.tsx',
  'components/GoalBadge.tsx',
].flatMap(walk).filter((f) => /\.(tsx?|css)$/.test(f));

const read = (f: string) => readFileSync(f, 'utf8');
const LEGACY = ['E8476C', 'F2728E', 'C93558', '9B7FD4', 'B9A4E3', 'FF8C6B', '7BC5AE'];

describe('#23 owned screens use tokens only', () => {
  it('finds owned files', () => {
    expect(OWNED.length).toBeGreaterThan(15);
  });

  it.each(OWNED.map((f) => [f.slice(src.length + 1), f]))('%s has no legacy hex', (_n, f) => {
    const s = read(f);
    for (const hex of LEGACY) expect(s, hex).not.toMatch(new RegExp(`#${hex}[0-9a-f]{0,2}\\b`, 'i'));
  });

  it.each(OWNED.map((f) => [f.slice(src.length + 1), f]))('%s has no raw hex colour literals', (_n, f) => {
    const s = read(f).replace(/&#\d+;/g, '');
    expect(s.match(/#[0-9a-fA-F]{3,8}\b(?![\w-])/g) ?? []).toEqual([]);
    expect(s).not.toMatch(/\b(?:stroke|fill|color)=["'](?:white|black)["']/);
  });

  it.each(OWNED.map((f) => [f.slice(src.length + 1), f]))('%s has no text-white / bg-white / tailwind palette colours', (_n, f) => {
    const s = read(f);
    expect(s).not.toMatch(/\btext-white\b/);
    expect(s).not.toMatch(/\bbg-white\b/);
    expect(s).not.toMatch(/\b(?:bg|text|border|ring)-(?:red|amber|emerald|rose|blue|green|yellow)-\d/);
  });
});

describe('local FLOW_COLORS copies', () => {
  const colors = `{
  light: 'var(--color-follicular)',
  medium: 'var(--color-primary)',
  heavy: 'var(--color-menstrual)',
}`;
  const text = `{
  light: 'var(--color-on-follicular)',
  medium: 'var(--color-on-accent)',
  heavy: 'var(--color-on-menstrual)',
}`;
  it.each(['app/onboarding/OnboardingClient.tsx', 'app/(main)/profiles/ProfilesClient.tsx'])('%s', (f) => {
    const s = read(join(src, f));
    expect(s).toContain(`FLOW_COLORS: Record<`);
    expect(s.replace(/\s+/g, ' ')).toContain(colors.replace(/\s+/g, ' '));
    expect(s.replace(/\s+/g, ' ')).toContain(text.replace(/\s+/g, ' '));
  });
});

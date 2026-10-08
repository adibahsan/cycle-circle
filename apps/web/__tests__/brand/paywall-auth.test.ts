import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const app = resolve(__dirname, '../../src/app');
const roots = [join(app, '(main)/subscription'), join(app, '(auth)')];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
  });
}
const files = roots.flatMap(walk);

describe('paywall + auth rebrand', () => {
  it.each(files.map((f) => [f.replace(app, ''), f]))('%s has no raw hex/rgba/legacy colour classes', (_n, f) => {
    const src = readFileSync(f, 'utf8');
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).not.toMatch(/rgba?\(/);
    expect(src).not.toMatch(/\b(text|bg|border)-(white|black|red|rose|pink|purple|violet)-?\d*/);
    expect(src).not.toMatch(/color="white"|(stroke|fill)="white"/);
    expect(src).not.toMatch(/Vesta|ভেস্তা/);
  });

  it('auth layout uses the full logo with alt "Cycle Circle"', () => {
    const src = readFileSync(join(app, '(auth)/layout.tsx'), 'utf8');
    expect(src).toContain('src="/brand/cycle-circle-logo.svg"');
    expect(src).toContain('alt="Cycle Circle"');
  });
});

describe('Pro badge contrast (accent 18% into card fill)', () => {
  const css = readFileSync(resolve(__dirname, '../../src/app/globals.css'), 'utf8');
  const block = (re: RegExp) => css.match(re)![1];
  const root = block(/\@theme\s*\{([\s\S]*?)\n\}/);
  const dark = block(/\n\.dark\s*\{([\s\S]*?)\n\}/);
  const tok = (b: string, n: string) => b.match(new RegExp(`--color-${n}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lum = (c: number[]) => {
    const [r, g, b] = c.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: number[], b: number[]) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  it('badges use text-primary on the tinted fill (gold-ink fails AA in light)', () => {
    const src = readFileSync(join(app, '(main)/subscription/SubscriptionClient.tsx'), 'utf8');
    const badges = src.match(/[^"]*var\(--color-accent\)_18%[^"]*/g) ?? [];
    expect(badges.length).toBeGreaterThan(0);
    for (const b of badges) expect(b).not.toContain('gold-ink');
  });

  it('gold-ink on the fill is AA in dark (documented: not in light)', () => {
    const card = rgb(tok(dark, 'bg-card')!);
    const fill = rgb(tok(dark, 'accent')!).map((v, i) => 0.18 * v + 0.82 * card[i]);
    expect(ratio(rgb(tok(dark, 'gold-ink')!), fill)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['light', root, root],
    ['dark', dark, dark],
  ])('%s text-primary on badge fill >= 4.5:1', (_n, b, fallback) => {
    const get = (n: string) => tok(b, n) ?? tok(fallback, n)!;
    const card = rgb(get('bg-card'));
    const fill = rgb(get('accent')).map((v, i) => 0.18 * v + 0.82 * card[i]);
    expect(ratio(rgb(get('text-primary')), fill)).toBeGreaterThanOrEqual(4.5);
  });
});

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const apps = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(apps, p));

describe.each(['web', 'admin'])('brand assets (%s)', (app) => {
  it.each(['public/brand/cycle-circle-logo.svg', 'public/brand/drop.svg', 'src/app/icon.svg', 'src/app/apple-icon.svg'])(
    '%s is a well-formed SVG',
    (file) => {
      const path = `${app}/${file}`;
      expect(existsSync(resolve(apps, path))).toBe(true);
      const svg = read(path).toString('utf8').trim();
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.endsWith('</svg>')).toBe(true);
      expect(svg).not.toContain('>V</text>');
    },
  );

  it('ships a PNG logo for email', () => {
    const png = read(`${app}/public/brand/cycle-circle-logo.png`);
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(480);
  });

  it('VestaLogo is labelled Cycle Circle', () => {
    expect(read(`${app}/src/components/ui/VestaLogo.tsx`).toString()).toContain('aria-label="Cycle Circle"');
  });
});

describe('Open Graph image', () => {
  it('is 1200x630 PNG', () => {
    const png = read('web/public/opengraph-image.png');
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });
});

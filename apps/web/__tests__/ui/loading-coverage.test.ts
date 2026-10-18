import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const APP = path.resolve(__dirname, '../../src/app')

describe('loading skeleton coverage', () => {
  const dirs = [
    ...fs
      .readdirSync(path.join(APP, '(main)'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(APP, '(main)', d.name)),
    path.join(APP, 'onboarding'),
  ].filter((d) => fs.existsSync(path.join(d, 'page.tsx')))

  it('finds the pages to check', () => {
    expect(dirs.length).toBeGreaterThan(5)
  })

  it.each(dirs.map((d) => [path.relative(APP, d), d]))('%s has a loading.tsx', (_name, dir) => {
    expect(fs.existsSync(path.join(dir, 'loading.tsx'))).toBe(true)
  })

  it('insights skeleton uses the canvas width', () => {
    const src = fs.readFileSync(path.join(APP, '(main)/insights/loading.tsx'), 'utf8')
    expect(src).toContain('width="canvas"')
  })
})

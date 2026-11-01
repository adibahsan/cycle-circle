#!/usr/bin/env node
// `pnpm handbook:check`: confirms the handbook still covers the product.
//   node scripts/check-handbook.mjs [--skip-build]
// 1 route coverage  2 links and anchors  3 screenshots  4 HTML and PDF build.
// Exit code 0 = all green. --skip-build skips check 4 (a quick run while writing).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { checkLinks, checkRoutes, checkScreenshots, collectAnchors, parseRoutes, routeFromPagePath } from './handbook/check.mjs'
import { parseIndex } from './handbook/outline.mjs'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const hb = path.join(root, 'docs/handbook')
const read = (p) => fs.readFileSync(p, 'utf8')

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)).map((f) => path.join(e.name, f)) : [e.name]))
}

const pages = [['user', 'apps/web/src/app'], ['admin', 'apps/admin/src/app']].flatMap(([app, dir]) =>
  walk(path.join(root, dir))
    .filter((f) => /(^|\/)page\.tsx$/.test(f))
    .map((f) => ({ app, route: routeFromPagePath(f) })),
)

const chapterFiles = parseIndex(read(path.join(hb, 'index.md'))).flatMap((p) => p.chapters.map((c) => c.file))
const chapters = Object.fromEntries(chapterFiles.map((f) => [f, read(path.join(hb, f))]))
const shotFiles = fs.readdirSync(path.join(hb, 'screenshots')).filter((f) => !f.startsWith('.'))

const results = [
  ['Route coverage (every User and Admin page has a handbook section)', () => checkRoutes(pages, parseRoutes(read(path.join(hb, 'routes.md'))), collectAnchors(chapters))],
  ['Links and anchors (every internal link lands on a section)', () => checkLinks(chapters, { exists: (t, from) => fs.existsSync(path.resolve(hb, path.dirname(from), t)) })],
  ['Screenshots (all referenced images exist, none are unused)', () => checkScreenshots(chapters, shotFiles)],
]
if (!process.argv.includes('--skip-build')) {
  results.push([
    'Build (HTML and PDF)',
    () => {
      const r = spawnSync('node', [path.join(root, 'scripts/build-handbook.mjs')], { encoding: 'utf8' })
      return r.status === 0 ? [] : [`The build failed (exit ${r.status}). Last output:\n${`${r.stdout}${r.stderr}`.trim().split('\n').slice(-12).join('\n')}`]
    },
  ])
}

let failed = 0
for (const [name, run] of results) {
  const problems = run()
  console.log(`${problems.length ? 'FAIL' : 'PASS'}  ${name}`)
  for (const p of problems) console.log(`      - ${p}`)
  if (problems.length) failed++
}
console.log(failed ? `\n${failed} of ${results.length} checks failed. Fix the items above and run \`pnpm handbook:check\` again.` : `\nAll ${results.length} checks passed.`)
process.exit(failed ? 1 : 0)

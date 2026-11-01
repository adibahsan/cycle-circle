import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkLinks, checkRoutes, checkScreenshots, parseRoutes, routeFromPagePath } from './check.mjs'

test('routeFromPagePath drops route groups and keeps dynamic segments', () => {
  assert.equal(routeFromPagePath('(main)/dashboard/page.tsx'), '/dashboard')
  assert.equal(routeFromPagePath('(admin)/users/[id]/page.tsx'), '/users/[id]')
  assert.equal(routeFromPagePath('page.tsx'), '/')
  assert.equal(routeFromPagePath('(admin)/page.tsx'), '/')
})

const ROUTES_MD = `
## Covered
| Route | App | Section |
|---|---|---|
| \`/dashboard\` | user | \`db-hero\` |
| \`/\` | admin | \`ov-kpis\` |
## Excluded
| Route | App | Why |
|---|---|---|
| \`/internal/x\` | user | dev only |
`

test('parseRoutes reads covered and excluded tables', () => {
  const r = parseRoutes(ROUTES_MD)
  assert.deepEqual(r.covered, [
    { route: '/dashboard', app: 'user', anchor: 'db-hero' },
    { route: '/', app: 'admin', anchor: 'ov-kpis' },
  ])
  assert.deepEqual(r.excluded, [{ route: '/internal/x', app: 'user', why: 'dev only' }])
})

test('checkRoutes flags unmapped pages, unknown anchors and stale rows', () => {
  const pages = [
    { app: 'user', route: '/dashboard' },
    { app: 'user', route: '/internal/x' },
    { app: 'user', route: '/new-page' },
    { app: 'admin', route: '/' },
  ]
  const problems = checkRoutes(pages, parseRoutes(ROUTES_MD), new Set(['db-hero']))
  assert.equal(problems.length, 2)
  assert.match(problems.join('\n'), /User page \/new-page .*no handbook section/)
  assert.match(problems.join('\n'), /Admin page \/ .*ov-kpis.*does not exist/)
})

test('checkRoutes flags a mapping row for a page that no longer exists', () => {
  const problems = checkRoutes([], parseRoutes(ROUTES_MD), new Set(['db-hero', 'ov-kpis']))
  assert.equal(problems.length, 3)
  assert.match(problems[0], /no longer exists/)
})

test('checkLinks resolves anchors across chapters, template headings and relative files', () => {
  const chapters = {
    'a.md': '## A {#a-one}\n### How to use it\nSee [B](#b-two) and [h](#a-one--how-to-use-it) and [x](#nope) and [f](b.md) [g](gone.md) [e](https://x.org).',
    'b.md': '## B {#b-two}\n',
  }
  const problems = checkLinks(chapters)
  assert.equal(problems.length, 2)
  assert.match(problems[0], /a\.md.*#nope/)
  assert.match(problems[1], /a\.md.*gone\.md/)
})

test('checkLinks reports duplicate anchors', () => {
  const problems = checkLinks({ 'a.md': '## A {#x}\n', 'b.md': '## B {#x}\n' })
  assert.match(problems[0], /#x .*defined more than once/)
})

test('checkScreenshots flags missing and unreferenced images', () => {
  const chapters = { 'a.md': '![ok](../screenshots/a.png)\n![gone](../screenshots/b.png)' }
  const problems = checkScreenshots(chapters, ['a.png', 'c.png'])
  assert.equal(problems.length, 2)
  assert.match(problems[0], /a\.md.*b\.png.*missing/)
  assert.match(problems[1], /c\.png.*not used/)
})

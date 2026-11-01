// Pure checks behind `pnpm handbook:check` (scripts/check-handbook.mjs does the file reading).
// Each check returns a list of plain-English problems; an empty list means it passes.

/** `(main)/dashboard/page.tsx` -> `/dashboard`; route groups vanish, dynamic segments stay. */
export function routeFromPagePath(rel) {
  const segs = rel
    .replace(/\\/g, '/')
    .replace(/(^|\/)page\.tsx$/, '')
    .split('/')
    .filter((s) => s && !/^\(.*\)$/.test(s))
  return `/${segs.join('/')}`
}

const unTick = (s) => s.trim().replace(/^`|`$/g, '')

/** routes.md: a table of covered pages (route, app, section anchor) and one of excluded pages (route, app, why). */
export function parseRoutes(md) {
  const covered = []
  const excluded = []
  let mode = ''
  for (const line of md.split('\n')) {
    const h = line.match(/^##\s+(Covered|Excluded)/i)
    if (h) {
      mode = h[1].toLowerCase()
      continue
    }
    const cells = line.match(/^\|(.+)\|\s*$/)?.[1].split('|').map((c) => c.trim())
    if (!cells || cells.length < 3 || !cells[0].startsWith('`')) continue
    const [route, app, third] = [unTick(cells[0]), cells[1].toLowerCase(), cells[2]]
    if (mode === 'covered') covered.push({ route, app, anchor: unTick(third) })
    if (mode === 'excluded') excluded.push({ route, app, why: third })
  }
  return { covered, excluded }
}

const label = (app) => (app === 'admin' ? 'Admin' : 'User')

/** Every page needs a covering section or a stated exclusion; every mapping must point at a real section and a real page. */
export function checkRoutes(pages, { covered, excluded }, anchors) {
  const problems = []
  const key = (app, route) => `${app} ${route}`
  const real = new Set(pages.map((p) => key(p.app, p.route)))
  const mapped = new Map(covered.map((c) => [key(c.app, c.route), c]))
  const skipped = new Set(excluded.map((c) => key(c.app, c.route)))
  for (const p of pages) {
    const k = key(p.app, p.route)
    if (skipped.has(k)) continue
    const m = mapped.get(k)
    if (!m) problems.push(`${label(p.app)} page ${p.route} has no handbook section. Write one, then add it to the Covered table in docs/handbook/routes.md (or list it under Excluded with a reason).`)
    else if (!anchors.has(m.anchor)) problems.push(`${label(p.app)} page ${p.route} is mapped to section ${m.anchor}, which does not exist. Fix the anchor in docs/handbook/routes.md.`)
  }
  for (const r of [...covered, ...excluded]) {
    if (!real.has(key(r.app, r.route))) problems.push(`docs/handbook/routes.md lists ${label(r.app)} page ${r.route}, which no longer exists in the app. Remove the row.`)
  }
  return problems
}

const slug = (t) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')

/** Strip fenced code so links inside examples are ignored. */
function prose(md) {
  let fenced = false
  return md.split('\n').map((l) => {
    if (/^\s*```/.test(l)) fenced = !fenced
    return fenced ? '' : l
  })
}

/** Anchors defined by one chapter: `{#id}` headings plus `id--heading-slug` for the template headings under them. */
function anchorsOf(md) {
  const ids = []
  let section = ''
  for (const line of prose(md)) {
    const h = line.match(/^(#{1,6})\s+(.*?)\s*(?:\{#([\w-]+)\})?\s*$/)
    if (!h) continue
    if (h[3]) {
      ids.push(h[3])
      if (h[1].length <= 2) section = h[3]
    } else if (section && h[1].length === 3) ids.push(`${section}--${slug(h[2])}`)
  }
  return ids
}

export function collectAnchors(chapters) {
  return new Set(Object.values(chapters).flatMap(anchorsOf))
}

/** Duplicate anchors, then every `[..](#id)` and `[..](file.md#id)` link. `exists(target, fromFile)` overrides the file test. */
export function checkLinks(chapters, { exists } = {}) {
  const problems = []
  const owners = new Map()
  for (const [file, md] of Object.entries(chapters)) {
    for (const id of anchorsOf(md)) {
      if (owners.has(id) && owners.get(id) !== file) problems.push(`Anchor #${id} is defined more than once (${owners.get(id)} and ${file}). Anchors must be unique across the handbook.`)
      owners.set(id, file)
    }
  }
  const fileOk = exists ?? ((t) => t in chapters)
  for (const [file, md] of Object.entries(chapters)) {
    for (const line of prose(md)) {
      for (const m of line.matchAll(/(!?)\[[^\]]*\]\(([^)\s]+)[^)]*\)/g)) {
        if (m[1] || /^[a-z][a-z0-9+.-]*:/i.test(m[2])) continue
        const [target, frag] = m[2].split('#')
        if (target && !fileOk(target, file)) problems.push(`${file}: link to ${m[2]} points at a file that does not exist.`)
        else if (frag && !target && !owners.has(frag)) problems.push(`${file}: link to #${frag} does not match any section anchor.`)
        else if (frag && target in chapters && !owners.has(frag)) problems.push(`${file}: link to ${m[2]} does not match any section anchor.`)
      }
    }
  }
  return problems
}

/** Every `![..](../screenshots/x.png)` must exist in the folder and every file in the folder must be used. */
export function checkScreenshots(chapters, files) {
  const problems = []
  const used = new Set()
  for (const [file, md] of Object.entries(chapters)) {
    for (const line of prose(md)) {
      for (const m of line.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) {
        const name = m[1].replace(/^.*screenshots\//, '')
        used.add(name)
        if (!files.includes(name)) problems.push(`${file}: screenshot ${name} is referenced but missing from docs/handbook/screenshots/. Capture it (pnpm handbook:capture) or fix the name.`)
      }
    }
  }
  for (const f of files) if (!used.has(f)) problems.push(`docs/handbook/screenshots/${f} is not used by any chapter. Reference it in a section or delete it.`)
  return problems
}

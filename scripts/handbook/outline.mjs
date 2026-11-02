// Parsers for docs/handbook/index.md (chapter order) and docs/handbook/OUTLINE.md (sections,
// anchors, screenshot names, owning tickets). Shared by the build and the screenshot helper.

const PART_RE = /^##\s+Part\s+\d+:\s*(.+?)\s*$/

/** @returns {{title: string, chapters: {title: string, file: string}[]}[]} */
export function parseIndex(md) {
  const parts = []
  for (const line of md.split('\n')) {
    const part = line.match(PART_RE)
    if (part) {
      parts.push({ title: part[1], chapters: [] })
      continue
    }
    const ch = line.match(/^\s*\d+\.\s+\[(.+?)\]\((.+?)\)\s*$/)
    if (ch && parts.length) parts[parts.length - 1].chapters.push({ title: ch[1], file: ch[2] })
  }
  return parts
}

/** @returns {{part: string, title: string, file: string, ticket: string, device: string, sections: {anchor: string, title: string, screenshot: string}[]}[]} */
export function parseOutline(md) {
  const chapters = []
  let part = ''
  let cur = null
  const tick = (s) => s.replace(/^`|`$/g, '')
  for (const line of md.split('\n')) {
    const p = line.match(PART_RE)
    if (p) {
      part = p[1]
      cur = null
      continue
    }
    const h = line.match(/^###\s+(.+?)\s*$/)
    if (h) {
      cur = { part, title: h[1], file: '', ticket: '', device: '', sections: [] }
      chapters.push(cur)
      continue
    }
    if (!cur) continue
    const meta = line.match(/^-\s+(File|Ticket|Device):\s*(.+?)\s*$/)
    if (meta) {
      cur[meta[1].toLowerCase()] = tick(meta[2])
      continue
    }
    const row = line.match(/^\|\s*`([^`]+)`\s*\|\s*(.+?)\s*\|\s*`([^`]+)`\s*\|\s*$/)
    if (row) cur.sections.push({ anchor: row[1], title: row[2], screenshot: row[3] })
  }
  return chapters
}

/** Problems between the index and the outline; empty when they agree. */
export function checkConsistency(parts, chapters) {
  const problems = []
  const indexFiles = parts.flatMap((p) => p.chapters.map((c) => c.file))
  const outlineFiles = chapters.map((c) => c.file)
  if (indexFiles.join('\n') !== outlineFiles.join('\n')) {
    problems.push(`chapter file order differs: index [${indexFiles.join(', ')}] vs outline [${outlineFiles.join(', ')}]`)
  }
  const seen = new Set()
  for (const c of chapters) {
    if (!c.ticket) problems.push(`${c.title}: no Ticket`)
    if (!['phone', 'desktop'].includes(c.device)) problems.push(`${c.title}: Device must be phone or desktop`)
    for (const s of c.sections) {
      if (seen.has(s.anchor)) problems.push(`duplicate anchor ${s.anchor}`)
      seen.add(s.anchor)
      if (s.screenshot !== `${s.anchor}.png`) problems.push(`${s.anchor}: screenshot must be ${s.anchor}.png, got ${s.screenshot}`)
    }
  }
  return problems
}

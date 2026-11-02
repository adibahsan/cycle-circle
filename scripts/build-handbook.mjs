#!/usr/bin/env node
// Builds the Cycle Circle Handbook from docs/handbook/ into one HTML page and a PDF with pandoc.
//   node scripts/build-handbook.mjs [--no-pdf] [--no-html]
// HTML: docs/vesta/source/cycle-circle-handbook.html (published through `pnpm docs:sync`).
// PDF:  docs/handbook/dist/cycle-circle-handbook.pdf (gitignored).
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { checkConsistency, parseIndex, parseOutline } from './handbook/outline.mjs'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const hb = path.join(root, 'docs/handbook')
const args = new Set(process.argv.slice(2))
const htmlOut = path.join(root, 'docs/vesta/source/cycle-circle-handbook.html')
const pdfOut = path.join(hb, 'dist/cycle-circle-handbook.pdf')

const read = (f) => fs.readFileSync(path.join(hb, f), 'utf8')
const parts = parseIndex(read('index.md'))
const problems = checkConsistency(parts, parseOutline(read('OUTLINE.md')))
if (problems.length) {
  console.error(`Handbook index and outline disagree:\n- ${problems.join('\n- ')}`)
  process.exit(1)
}

/** Push every heading outside code fences down one level (chapter H1 -> H2, section H2 -> H3, ...). */
function shiftHeadings(md) {
  let fenced = false
  return md
    .split('\n')
    .map((line) => {
      if (/^\s*```/.test(line)) fenced = !fenced
      return !fenced && /^#{1,5}\s/.test(line) ? `#${line}` : line
    })
    .join('\n')
}

/** Latin Modern (the default) lacks arrows and some quotes; use Helvetica Neue where installed. */
function hasFont(name) {
  try {
    return execFileSync('fc-list', [name], { encoding: 'utf8' }).trim().length > 0
  } catch {
    return false
  }
}

let placeholders = 0
const chunks = []
parts.forEach((part, i) => {
  chunks.push(`# ${part.title} {#part-${i + 1}}\n`)
  for (const ch of part.chapters) {
    const body = read(ch.file)
    placeholders += (body.match(/^> Placeholder:/gm) ?? []).length
    chunks.push(shiftHeadings(body))
  }
})
const front = read('index.md').split('<!-- end-intro -->')[0].replace(/^# .*\n/, '').trim()
const combined = path.join(hb, 'dist/combined.md')
fs.mkdirSync(path.dirname(combined), { recursive: true })
fs.writeFileSync(combined, `${front}\n\n\\newpage\n\n${chunks.join('\n')}`)

const common = [
  combined,
  '--from=markdown+smart',
  `--resource-path=${path.join(hb, 'chapters')}`,
  `--lua-filter=${path.join(hb, 'build/handbook.lua')}`,
  '--toc',
  '--toc-depth=3',
  '--number-sections',
  '--metadata=title:Cycle Circle Handbook',
  '--metadata=lang:en',
  `--metadata=date:${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })}`,
]

if (!args.has('--no-html')) {
  fs.mkdirSync(path.dirname(htmlOut), { recursive: true })
  execFileSync('pandoc', [...common, '--to=html5', '--standalone', '--embed-resources', `--css=${path.join(hb, 'build/handbook.css')}`, '-o', htmlOut], { stdio: 'inherit' })
  console.log(`html: ${path.relative(root, htmlOut)} (${(fs.statSync(htmlOut).size / 1e6).toFixed(1)} MB)`)
}
if (!args.has('--no-pdf')) {
  execFileSync(
    'pandoc',
    [
      ...common,
      '--pdf-engine=xelatex',
      '-V', 'geometry:margin=2.2cm',
      '-V', 'colorlinks=true',
      '-V', 'linkcolor=teal',
      ...(hasFont('Helvetica Neue') ? ['-V', 'mainfont=Helvetica Neue'] : []),
      '-H', path.join(hb, 'build/pdf-header.tex'),
      '-o', pdfOut,
    ],
    { stdio: 'inherit' },
  )
  console.log(`pdf:  ${path.relative(root, pdfOut)} (${(fs.statSync(pdfOut).size / 1e6).toFixed(1)} MB)`)
}
console.log(`placeholders left: ${placeholders}`)

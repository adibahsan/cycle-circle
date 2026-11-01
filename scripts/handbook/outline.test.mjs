import test from 'node:test'
import assert from 'node:assert/strict'
import { parseIndex, parseOutline, checkConsistency } from './outline.mjs'

const INDEX = `# Handbook

Intro text.

## Part 1: User Guide

1. [Getting started](chapters/getting-started.md)
2. [Plans](chapters/plans.md)

## Part 2: Admin Guide

1. [Users](chapters/users.md)
`

const OUTLINE = `# Outline

## Part 1: User Guide

### Getting started

- File: \`chapters/getting-started.md\`
- Ticket: #239
- Device: phone

| Anchor | Section | Screenshot |
|---|---|---|
| \`gs-welcome\` | Welcome page | \`gs-welcome.png\` |
| \`gs-login\` | Phone login | \`gs-login.png\` |

### Plans

- File: \`chapters/plans.md\`
- Ticket: #240
- Device: phone

| Anchor | Section | Screenshot |
|---|---|---|
| \`pl-pro\` | Pro | \`pl-pro.png\` |

## Part 2: Admin Guide

### Users

- File: \`chapters/users.md\`
- Ticket: #245
- Device: desktop

| Anchor | Section | Screenshot |
|---|---|---|
| \`us-list\` | User list | \`us-list.png\` |
`

test('parseIndex returns parts with chapters in order', () => {
  const parts = parseIndex(INDEX)
  assert.deepEqual(parts.map((p) => p.title), ['User Guide', 'Admin Guide'])
  assert.deepEqual(parts[0].chapters, [
    { title: 'Getting started', file: 'chapters/getting-started.md' },
    { title: 'Plans', file: 'chapters/plans.md' },
  ])
})

test('parseOutline returns chapters with owner, device and sections', () => {
  const chapters = parseOutline(OUTLINE)
  assert.equal(chapters.length, 3)
  assert.deepEqual(chapters[0], {
    part: 'User Guide',
    title: 'Getting started',
    file: 'chapters/getting-started.md',
    ticket: '#239',
    device: 'phone',
    sections: [
      { anchor: 'gs-welcome', title: 'Welcome page', screenshot: 'gs-welcome.png' },
      { anchor: 'gs-login', title: 'Phone login', screenshot: 'gs-login.png' },
    ],
  })
  assert.equal(chapters[2].device, 'desktop')
})

test('checkConsistency passes when index and outline agree', () => {
  assert.deepEqual(checkConsistency(parseIndex(INDEX), parseOutline(OUTLINE)), [])
})

test('checkConsistency reports order mismatch, duplicate anchors and bad screenshot names', () => {
  const bad = OUTLINE.replace('`pl-pro` | Pro | `pl-pro.png`', '`gs-login` | Pro | `other.png`')
  const problems = checkConsistency(parseIndex(INDEX), parseOutline(bad))
  assert.ok(problems.some((p) => /duplicate anchor/.test(p)))
  assert.ok(problems.some((p) => /screenshot/.test(p)))
  const swapped = INDEX.replace('getting-started', 'X').replace('plans', 'getting-started').replace('X', 'plans')
  assert.ok(checkConsistency(parseIndex(swapped), parseOutline(OUTLINE)).some((p) => /order|file/.test(p)))
})

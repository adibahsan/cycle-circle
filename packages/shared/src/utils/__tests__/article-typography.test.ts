import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../../../../..')
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')

const SHARED_CSS = 'packages/shared/src/styles/article-typography.css'

describe('shared article typography', () => {
  const css = read(SHARED_CSS)

  it.each(['h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'img', 'a'])(
    'styles %s inside .article-body',
    (tag) => {
      expect(css).toMatch(new RegExp(`\\.article-body\\s+${tag}\\b`))
    },
  )

  it.each([
    ['apps/admin/src/app/globals.css'],
    ['apps/web/src/app/globals.css'],
  ])('%s imports the shared stylesheet', (file) => {
    expect(read(file)).toContain('packages/shared/src/styles/article-typography.css')
  })

  it.each([
    ['apps/admin/src/components/TiptapEditor.tsx'],
    ['apps/web/src/app/(main)/content/ContentClient.tsx'],
  ])('%s renders the article body with .article-body', (file) => {
    expect(read(file)).toMatch(/\barticle-body\b/)
  })
})

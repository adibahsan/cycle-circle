import { describe, it, expect } from 'vitest'
import { sanitizeArticleHtml } from '@vesta/shared/server/services'

describe('sanitizeArticleHtml', () => {
  it('strips <script> tags and their content', () => {
    const result = sanitizeArticleHtml('<p>Hello</p><script>alert(1)</script>')
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('alert(1)')
    expect(result).toContain('<p>Hello</p>')
  })

  it('strips event handler attributes', () => {
    const result = sanitizeArticleHtml('<p onclick="evil()">x</p>')
    expect(result).not.toContain('onclick')
  })

  it('preserves safe formatting and adds rel to links', () => {
    const result = sanitizeArticleHtml('<strong>bold</strong> <a href="https://x.com">l</a>')
    expect(result).toContain('<strong>bold</strong>')
    expect(result).toContain('href="https://x.com"')
    expect(result).toContain('rel="noopener noreferrer"')
  })

  it('neutralises javascript: URLs in anchors', () => {
    const result = sanitizeArticleHtml('<a href="javascript:alert(1)">x</a>')
    expect(result).not.toContain('javascript:')
  })

  it('removes <iframe> elements entirely', () => {
    const result = sanitizeArticleHtml('<iframe src="https://evil"></iframe>')
    expect(result).not.toContain('<iframe')
  })
})

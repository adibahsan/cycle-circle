import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  sanitizeArticleHtml,
  saveArticleImage,
  resolveUploadFile,
  ARTICLE_IMAGE_MAX_BYTES,
} from '@vesta/shared/server/services'

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')
const JPEG = Buffer.from('ffd8ffe000104a464946', 'hex')
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')])
const GIF = Buffer.from('GIF89a0000', 'latin1')

let dir: string
beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vesta-uploads-'))
  process.env.UPLOAD_DIR = dir
})
afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe('saveArticleImage', () => {
  it('stores a PNG under a generated name and returns its /uploads url', async () => {
    const r = await saveArticleImage(PNG)
    expect(r.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/)
    const stored = await fs.readFile(path.join(dir, r.name))
    expect(stored.equals(PNG)).toBe(true)
  })

  it('accepts jpeg, webp and gif by content', async () => {
    expect((await saveArticleImage(JPEG)).name).toMatch(/\.jpg$/)
    expect((await saveArticleImage(WEBP)).name).toMatch(/\.webp$/)
    expect((await saveArticleImage(GIF)).name).toMatch(/\.gif$/)
  })

  it('rejects non-image content (even if named like one)', async () => {
    await expect(saveArticleImage(Buffer.from('<svg onload=alert(1)>'))).rejects.toThrow(/type/i)
    await expect(saveArticleImage(Buffer.from('<?php echo 1;'))).rejects.toThrow(/type/i)
  })

  it('rejects oversize and empty files', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(ARTICLE_IMAGE_MAX_BYTES)])
    await expect(saveArticleImage(big)).rejects.toThrow(/large|size/i)
    await expect(saveArticleImage(Buffer.alloc(0))).rejects.toThrow()
  })
})

describe('resolveUploadFile', () => {
  it('resolves a generated name and rejects traversal / odd names', async () => {
    const r = await saveArticleImage(PNG)
    expect(resolveUploadFile(r.name)).toEqual({
      filePath: path.join(dir, r.name),
      contentType: 'image/png',
    })
    expect(resolveUploadFile('../etc/passwd')).toBeNull()
    expect(resolveUploadFile('a/b.png')).toBeNull()
    expect(resolveUploadFile('x.svg')).toBeNull()
    expect(resolveUploadFile('.png')).toBeNull()
  })
})

describe('sanitizeArticleHtml images', () => {
  it('keeps img from the uploads path', () => {
    const out = sanitizeArticleHtml('<p>a</p><img src="/uploads/abc-123.png" alt="x">')
    expect(out).toContain('<img src="/uploads/abc-123.png" alt="x" />')
  })

  it('drops img from anywhere else', () => {
    for (const src of [
      'https://evil.com/a.png',
      '//evil.com/a.png',
      'data:image/png;base64,AAAA',
      '/uploads/../secret.png',
      '/uploads/a/b.png',
      '/other/a.png',
      'javascript:alert(1)',
    ]) {
      expect(sanitizeArticleHtml(`<img src="${src}">`)).not.toContain('<img')
    }
  })
})

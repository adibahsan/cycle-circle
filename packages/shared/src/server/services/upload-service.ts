import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Article image uploads. Files live in `UPLOAD_DIR` (a Docker volume in prod, shared by
 * `admin` (writes) and `web` (serves)) and are addressed as `/uploads/<generated-name>`.
 * The type is decided from the file's magic bytes, never from the client-supplied name/MIME.
 */

export const ARTICLE_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const UPLOADS_URL_PREFIX = '/uploads/'

const TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
} as const
type ImageExt = keyof typeof TYPES

/** Matches only names this service generates. */
const UPLOAD_NAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|gif)$/

export function uploadsDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
}

function sniffImageExt(b: Buffer): ImageExt | null {
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'png'
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp'
  if (b.length >= 6 && /^GIF8[79]a$/.test(b.toString('latin1', 0, 6))) return 'gif'
  return null
}

export async function saveArticleImage(data: Buffer): Promise<{ name: string; url: string }> {
  if (data.length === 0) throw new Error('The file is empty.')
  if (data.length > ARTICLE_IMAGE_MAX_BYTES) {
    throw new Error(`Image is too large (max ${ARTICLE_IMAGE_MAX_BYTES / 1024 / 1024} MB).`)
  }
  const ext = sniffImageExt(data)
  if (!ext) throw new Error('Unsupported file type. Use PNG, JPEG, WebP or GIF.')

  const name = `${randomUUID()}.${ext}`
  const dir = uploadsDir()
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, name), data, { flag: 'wx' })
  return { name, url: `${UPLOADS_URL_PREFIX}${name}` }
}

/** Map a requested file name to its path + content type; null for anything we did not generate. */
export function resolveUploadFile(name: string): { filePath: string; contentType: string } | null {
  if (!UPLOAD_NAME_RE.test(name)) return null
  const ext = name.slice(name.lastIndexOf('.') + 1) as ImageExt
  return { filePath: path.join(uploadsDir(), name), contentType: TYPES[ext] }
}

/** Pixel comparison of two PNG files, so a re-encode of the same picture is not a change. */
import zlib from 'node:zlib'

interface Decoded {
  header: string
  channels: number
  pixels: Buffer
}

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 }

function decode(png: Buffer): Decoded | null {
  if (png.length < 8 || png.readUInt32BE(0) !== 0x89504e47) return null
  let header = ''
  let width = 0
  let height = 0
  let bpp = 0
  const idat: Buffer[] = []
  for (let o = 8; o + 8 <= png.length; ) {
    const len = png.readUInt32BE(o)
    const type = png.toString('latin1', o + 4, o + 8)
    const data = png.subarray(o + 8, o + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      const channels = CHANNELS[data[9]!]
      if (data[8] !== 8 || data[12] !== 0 || !channels) return null // 8-bit, non-interlaced, no palette
      bpp = channels
      header = data.toString('hex')
    } else if (type === 'IDAT') idat.push(data)
    o += 12 + len
  }
  if (!bpp) return null
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = width * bpp
  const out = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)]!
    const src = y * (stride + 1) + 1
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[y * stride + i - bpp]! : 0
      const b = y > 0 ? out[(y - 1) * stride + i]! : 0
      const c = i >= bpp && y > 0 ? out[(y - 1) * stride + i - bpp]! : 0
      let add = 0
      if (f === 1) add = a
      else if (f === 2) add = b
      else if (f === 3) add = (a + b) >> 1
      else if (f === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      out[y * stride + i] = (raw[src + i]! + add) & 255
    }
  }
  return { header, channels: bpp, pixels: out }
}

/** Per-pixel colour tolerance (YIQ distance, as Playwright's `threshold`) and share of pixels allowed to exceed it. */
const THRESHOLD = 0.2
const MAX_DIFF_RATIO = 0.002
const MAX_YIQ_DELTA = 35215 * THRESHOLD * THRESHOLD // 35215 = largest possible YIQ delta

function rgbOf(px: Buffer, o: number, ch: number): [number, number, number] {
  const gray = ch <= 2
  const r = px[o]!
  const g = gray ? r : px[o + 1]!
  const b = gray ? r : px[o + 2]!
  const alpha = ch === 2 ? px[o + 1]! : ch === 4 ? px[o + 3]! : 255
  const k = alpha / 255 // blend over white
  return [255 + (r - 255) * k, 255 + (g - 255) * k, 255 + (b - 255) * k]
}

function pixelDiffers(a: Buffer, b: Buffer, o: number, ch: number): boolean {
  let same = true
  for (let i = 0; i < ch; i++) if (a[o + i] !== b[o + i]) same = false
  if (same) return false
  const [r1, g1, b1] = rgbOf(a, o, ch)
  const [r2, g2, b2] = rgbOf(b, o, ch)
  const y = (r1 - r2) * 0.29889531 + (g1 - g2) * 0.58662247 + (b1 - b2) * 0.11448223
  const i = (r1 - r2) * 0.59597799 - (g1 - g2) * 0.2741761 - (b1 - b2) * 0.32180189
  const q = (r1 - r2) * 0.21147017 - (g1 - g2) * 0.52261711 + (b1 - b2) * 0.31114694
  return 0.5053 * y * y + 0.299 * i * i + 0.1957 * q * q > MAX_YIQ_DELTA
}

/**
 * True when both PNGs have the same size and differ by no more than rendering noise: few pixels
 * beyond the colour threshold. Undecodable input compares by bytes.
 */
export function pngPixelsEqual(a: Buffer, b: Buffer): boolean {
  try {
    const da = decode(a)
    const db = decode(b)
    if (da && db) {
      if (da.header !== db.header) return false
      const { channels, pixels } = da
      const total = pixels.length / channels
      let differing = 0
      for (let o = 0; o < pixels.length; o += channels) if (pixelDiffers(pixels, db.pixels, o, channels)) differing++
      return differing / total <= MAX_DIFF_RATIO
    }
  } catch {
    // fall through to the byte comparison
  }
  return a.equals(b)
}

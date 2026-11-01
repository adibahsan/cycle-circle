/** Pixel comparison of two PNG files, so a re-encode of the same picture is not a change. */
import zlib from 'node:zlib'

interface Decoded {
  header: string
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
  return { header, pixels: out }
}

/** True when both PNGs decode to the same size and pixels. Undecodable input compares by bytes. */
export function pngPixelsEqual(a: Buffer, b: Buffer): boolean {
  try {
    const da = decode(a)
    const db = decode(b)
    if (da && db) return da.header === db.header && da.pixels.equals(db.pixels)
  } catch {
    // fall through to the byte comparison
  }
  return a.equals(b)
}

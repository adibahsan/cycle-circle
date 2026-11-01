import test from 'node:test'
import assert from 'node:assert/strict'
import zlib from 'node:zlib'
import { pngPixelsEqual } from './png-equal.ts'

function crc32(buf: Buffer): number {
  let c = ~0
  for (const b of buf) {
    c ^= b
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return ~c >>> 0
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
/** RGBA 8-bit PNG; `filter` 0 = None, 1 = Sub, applied to every row. */
function png(w: number, h: number, rgba: number[], filter: 0 | 1, level = 6): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const stride = w * 4
  const rows: Buffer[] = []
  for (let y = 0; y < h; y++) {
    const row = Buffer.from(rgba.slice(y * stride, (y + 1) * stride))
    const out = Buffer.alloc(stride + 1)
    out[0] = filter
    for (let i = 0; i < stride; i++) out[i + 1] = filter === 1 ? (row[i]! - (i >= 4 ? row[i - 4]! : 0)) & 255 : row[i]!
    rows.push(out)
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows), { level })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const px = [10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255, 100, 110, 120, 255]

test('same pixels encoded differently are equal', () => {
  assert.equal(pngPixelsEqual(png(2, 2, px, 0), png(2, 2, px, 1, 1)), true)
})

test('one changed pixel is not equal', () => {
  const other = [...px]
  other[5] = 51
  assert.equal(pngPixelsEqual(png(2, 2, px, 0), png(2, 2, other, 0)), false)
})

test('different size is not equal', () => {
  assert.equal(pngPixelsEqual(png(2, 2, px, 0), png(4, 1, px, 0)), false)
})

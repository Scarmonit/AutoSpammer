const fs = require('fs')
const zlib = require('zlib')

// ---------------------------------------------------------------------------
// Source-driven icon pipeline.
//
// Reads the branded artwork in build/icon-source.png and produces every icon
// the app needs: build/icon.png (512), build/icon.ico (16–256), docs/icon.png
// (256, for the README), and the embedded tray + window icons in
// src/main/trayicon.ts. Dependency-free: a tiny PNG decoder/encoder, area
// (box) downscaling, and a rounded-rect alpha mask so the square source reads
// as a proper rounded app icon at every size.
// ---------------------------------------------------------------------------

const SOURCE = 'build/icon-source.png'
/** Corner radius of the rounded-rect mask, as a fraction of the icon size. */
const CORNER_RADIUS = 0.2

// ---- PNG decode (8-bit, non-interlaced, RGB / RGBA) -----------------------
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG')
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  const bitDepth = buf[24]
  const colorType = buf[25]
  const interlace = buf[28]
  if (bitDepth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`unsupported PNG (bitDepth ${bitDepth}, colorType ${colorType}, interlace ${interlace})`)
  }
  const channels = colorType === 6 ? 4 : 3

  // Concatenate all IDAT chunks, then inflate.
  let pos = 8
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const start = pos + 8
    if (type === 'IDAT') idat.push(buf.subarray(start, start + len))
    pos = start + len + 4 // skip data + CRC
    if (type === 'IEND') break
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))

  // Un-filter scanlines into a flat RGBA buffer.
  const bpp = channels
  const stride = width * bpp
  const out = Buffer.alloc(width * height * 4)
  const prev = Buffer.alloc(stride)
  const cur = Buffer.alloc(stride)
  let rp = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++]
    raw.copy(cur, 0, rp, rp + stride)
    rp += stride
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0
      const b = prev[i]
      const c = i >= bpp ? prev[i - bpp] : 0
      let v = cur[i]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) v += paeth(a, b, c)
      cur[i] = v & 0xff
    }
    for (let x = 0; x < width; x++) {
      const s = x * bpp
      const d = (y * width + x) * 4
      out[d] = cur[s]
      out[d + 1] = cur[s + 1]
      out[d + 2] = cur[s + 2]
      out[d + 3] = channels === 4 ? cur[s + 3] : 255
    }
    cur.copy(prev)
  }
  return { width, height, data: out }
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

// ---- Resize (area average) + rounded-rect alpha mask ----------------------
/** Signed distance to a rounded rect (negative inside). */
function roundedDist(x, y, x0, y0, x1, y1, rad) {
  const cx = Math.min(Math.max(x, x0 + rad), x1 - rad)
  const cy = Math.min(Math.max(y, y0 + rad), y1 - rad)
  return Math.hypot(x - cx, y - cy) - rad
}

function resizeRounded(src, size) {
  const out = Buffer.alloc(size * size * 4)
  const sx = src.width / size
  const sy = src.height / size
  const rad = size * CORNER_RADIUS
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Box-average the source footprint for this destination pixel.
      const x0 = Math.floor(x * sx)
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx))
      const y0 = Math.floor(y * sy)
      const y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy))
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * src.width + xx) * 4
          r += src.data[i]
          g += src.data[i + 1]
          b += src.data[i + 2]
          n++
        }
      }
      // Anti-aliased rounded-rect mask so the corners are transparent.
      const dist = roundedDist(x + 0.5, y + 0.5, 0, 0, size, size, rad)
      const mask = Math.min(1, Math.max(0, 0.5 - dist))
      const o = (y * size + x) * 4
      out[o] = Math.round(r / n)
      out[o + 1] = Math.round(g / n)
      out[o + 2] = Math.round(b / n)
      out[o + 3] = Math.round(255 * mask)
    }
  }
  return out
}

// ---- PNG encode -----------------------------------------------------------
const crcTable = (() => {
  const t = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
const crc32 = (b) => {
  let c = 0xffffffff
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
  return Buffer.concat([len, t, data, crc])
}
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// ---- .ico (Vista+ PNG-in-ICO) ---------------------------------------------
function buildIco(imgs) {
  const count = imgs.length
  const dir = Buffer.alloc(6 + 16 * count)
  dir.writeUInt16LE(0, 0)
  dir.writeUInt16LE(1, 2)
  dir.writeUInt16LE(count, 4)
  let offset = 6 + 16 * count
  imgs.forEach((im, i) => {
    const e = 6 + i * 16
    dir[e] = im.size >= 256 ? 0 : im.size
    dir[e + 1] = im.size >= 256 ? 0 : im.size
    dir[e + 2] = 0
    dir[e + 3] = 0
    dir.writeUInt16LE(1, e + 4)
    dir.writeUInt16LE(32, e + 6)
    dir.writeUInt32LE(im.png.length, e + 8)
    dir.writeUInt32LE(offset, e + 12)
    offset += im.png.length
  })
  return Buffer.concat([dir, ...imgs.map((im) => im.png)])
}

// ---- Generate -------------------------------------------------------------
const src = decodePng(fs.readFileSync(SOURCE))
const png = (size) => encodePng(size, resizeRounded(src, size))

fs.writeFileSync('build/icon.png', png(512))
fs.mkdirSync('docs', { recursive: true })
fs.writeFileSync('docs/icon.png', png(256))

const icoSizes = [256, 128, 64, 48, 32, 16]
fs.writeFileSync(
  'build/icon.ico',
  buildIco(icoSizes.map((size) => ({ size, png: png(size) })))
)

// Embed tray (32) + window (256) icons as data URLs so they load via
// nativeImage with no runtime path/asar concerns in dev or packaged builds.
const trayB64 = png(32).toString('base64')
const windowB64 = png(256).toString('base64')
fs.writeFileSync(
  'src/main/trayicon.ts',
  '// AUTO-GENERATED by build/generate-icon.cjs — do not edit by hand.\n' +
    'export const TRAY_ICON_DATA_URL =\n' +
    `  'data:image/png;base64,${trayB64}'\n` +
    'export const WINDOW_ICON_DATA_URL =\n' +
    `  'data:image/png;base64,${windowB64}'\n`
)

console.log(
  `Generated icons from ${SOURCE} (${src.width}x${src.height}): ` +
    'build/icon.png (512), build/icon.ico (16–256), docs/icon.png (256), src/main/trayicon.ts (32 + 256)'
)

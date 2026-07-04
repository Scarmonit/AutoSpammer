// Pure pixel/template matching for the Detection triggers feature. No Electron
// or native imports, so it's unit-testable and shared by the screen-capture
// glue in detection.ts.

export interface Rgb {
  r: number
  g: number
  b: number
}

/**
 * A tightly packed 4-channel bitmap in BGRA byte order — the native pixel
 * format of both nut-js screen grabs and Electron's nativeImage on Windows.
 */
export interface RawImage {
  width: number
  height: number
  data: Uint8Array
}

/** '#rrggbb' -> {r,g,b}, or null when the string isn't a 6-digit hex color. */
export function hexToRgb(hex: string): Rgb | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex ?? '')
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff }
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to2 = (n: number): string => Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, '0')
  return `#${to2(r)}${to2(g)}${to2(b)}`
}

/** True when every RGB channel differs by at most `tolerance`. */
export function colorWithinTolerance(a: Rgb, b: Rgb, tolerance: number): boolean {
  const t = Math.max(0, tolerance)
  return Math.abs(a.r - b.r) <= t && Math.abs(a.g - b.g) <= t && Math.abs(a.b - b.b) <= t
}

/** One template pixel checked during the scan (offset + expected BGR bytes). */
interface Probe {
  offset: number // byte offset within the template row-major BGRA data
  dx: number
  dy: number
  b: number
  g: number
  r: number
}

/**
 * A sparse, evenly spread set of template pixels used to reject candidate
 * positions cheaply before the full pixel-by-pixel verification.
 */
function buildProbes(needle: RawImage, maxPerAxis = 8): Probe[] {
  const stepX = Math.max(1, Math.floor(needle.width / maxPerAxis))
  const stepY = Math.max(1, Math.floor(needle.height / maxPerAxis))
  const probes: Probe[] = []
  for (let dy = 0; dy < needle.height; dy += stepY) {
    for (let dx = 0; dx < needle.width; dx += stepX) {
      const off = (dy * needle.width + dx) * 4
      probes.push({
        offset: off,
        dx,
        dy,
        b: needle.data[off],
        g: needle.data[off + 1],
        r: needle.data[off + 2]
      })
    }
  }
  return probes
}

/**
 * Scan `hay` for `needle` with a per-channel tolerance. Returns true when the
 * template appears anywhere in the haystack. Every candidate position is
 * screened with the sparse probes (early exit on the first bad pixel), and
 * only probe hits get the full verification pass.
 */
export function findTemplate(hay: RawImage, needle: RawImage, tolerance: number): boolean {
  if (needle.width === 0 || needle.height === 0) return false
  if (needle.width > hay.width || needle.height > hay.height) return false

  const t = Math.max(0, tolerance)
  const probes = buildProbes(needle)
  const maxX = hay.width - needle.width
  const maxY = hay.height - needle.height

  for (let y = 0; y <= maxY; y++) {
    candidates: for (let x = 0; x <= maxX; x++) {
      for (const p of probes) {
        const ho = ((y + p.dy) * hay.width + (x + p.dx)) * 4
        if (
          Math.abs(hay.data[ho] - p.b) > t ||
          Math.abs(hay.data[ho + 1] - p.g) > t ||
          Math.abs(hay.data[ho + 2] - p.r) > t
        ) {
          continue candidates
        }
      }
      if (verifyAt(hay, needle, x, y, t)) return true
    }
  }
  return false
}

/** Full pixel-by-pixel check of the template at one candidate position. */
function verifyAt(hay: RawImage, needle: RawImage, x: number, y: number, t: number): boolean {
  for (let dy = 0; dy < needle.height; dy++) {
    let no = dy * needle.width * 4
    let ho = ((y + dy) * hay.width + x) * 4
    for (let dx = 0; dx < needle.width; dx++, no += 4, ho += 4) {
      if (
        Math.abs(hay.data[ho] - needle.data[no]) > t ||
        Math.abs(hay.data[ho + 1] - needle.data[no + 1]) > t ||
        Math.abs(hay.data[ho + 2] - needle.data[no + 2]) > t
      ) {
        return false
      }
    }
  }
  return true
}

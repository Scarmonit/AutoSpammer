import { describe, it, expect } from 'vitest'
import type { DetectionTrigger, ClickPosition } from '@shared/types'
import {
  hexToRgb,
  rgbToHex,
  colorWithinTolerance,
  findTemplate,
  boundingRect,
  evaluateFireGate,
  NEVER_FIRED,
  isTriggerReady,
  triggerIssue,
  type RawImage
} from '../../src/main/detectmatch'

/** Build a BGRA RawImage from a matrix of [r,g,b] pixels. */
function image(pixels: number[][][]): RawImage {
  const height = pixels.length
  const width = pixels[0]?.length ?? 0
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixels[y][x]
      const o = (y * width + x) * 4
      data[o] = b
      data[o + 1] = g
      data[o + 2] = r
      data[o + 3] = 255
    }
  }
  return { width, height, data }
}

/** A width×height image filled with one [r,g,b] color. */
function solid(width: number, height: number, rgb: number[]): RawImage {
  return image(Array.from({ length: height }, () => Array.from({ length: width }, () => rgb)))
}

describe('hex <-> rgb', () => {
  it('parses #rrggbb in either case', () => {
    expect(hexToRgb('#00ff80')).toEqual({ r: 0, g: 255, b: 128 })
    expect(hexToRgb('#A1B2C3')).toEqual({ r: 0xa1, g: 0xb2, b: 0xc3 })
  })

  it('rejects invalid strings', () => {
    expect(hexToRgb('')).toBeNull()
    expect(hexToRgb('#fff')).toBeNull()
    expect(hexToRgb('00ff80')).toBeNull()
    expect(hexToRgb('#00ff8g')).toBeNull()
  })

  it('round-trips through rgbToHex', () => {
    expect(rgbToHex(0, 255, 128)).toBe('#00ff80')
    expect(hexToRgb(rgbToHex(17, 34, 51))).toEqual({ r: 17, g: 34, b: 51 })
  })

  it('clamps out-of-range channels', () => {
    expect(rgbToHex(-5, 300, 12)).toBe('#00ff0c')
  })
})

describe('colorWithinTolerance', () => {
  const a = { r: 100, g: 150, b: 200 }

  it('matches exactly at tolerance 0', () => {
    expect(colorWithinTolerance(a, { ...a }, 0)).toBe(true)
    expect(colorWithinTolerance(a, { ...a, g: 151 }, 0)).toBe(false)
  })

  it('allows per-channel drift up to the tolerance', () => {
    expect(colorWithinTolerance(a, { r: 110, g: 140, b: 210 }, 10)).toBe(true)
    expect(colorWithinTolerance(a, { r: 111, g: 150, b: 200 }, 10)).toBe(false)
  })
})

describe('evaluateFireGate (repeat-while-true)', () => {
  it('fires immediately on the rising edge (first-ever match)', () => {
    const g = evaluateFireGate(true, 1000, NEVER_FIRED, 100)
    expect(g.shouldFire).toBe(true)
    expect(g.lastFiredAt).toBe(1000)
  })

  it('holds fire until repeatMs has elapsed, then fires again', () => {
    // Fired at t=1000; still true at t=1050 (<100 later) -> wait.
    const wait = evaluateFireGate(true, 1050, 1000, 100)
    expect(wait.shouldFire).toBe(false)
    expect(wait.lastFiredAt).toBe(1000) // unchanged

    // Still true at t=1100 (>=100 later) -> re-fire.
    const again = evaluateFireGate(true, 1100, 1000, 100)
    expect(again.shouldFire).toBe(true)
    expect(again.lastFiredAt).toBe(1100)
  })

  it('keeps re-firing every repeatMs for as long as the condition stays true', () => {
    let last = NEVER_FIRED
    const fires: number[] = []
    for (let now = 0; now <= 500; now += 25) {
      const g = evaluateFireGate(true, now, last, 100)
      last = g.lastFiredAt
      if (g.shouldFire) fires.push(now)
    }
    // Immediate at 0, then ~every 100 ms: 0, 100, 200, 300, 400, 500.
    expect(fires).toEqual([0, 100, 200, 300, 400, 500])
  })

  it('re-arms when the condition goes false, so the next true fires at once', () => {
    const off = evaluateFireGate(false, 1200, 1000, 100)
    expect(off.shouldFire).toBe(false)
    expect(off.lastFiredAt).toBe(NEVER_FIRED)

    const backOn = evaluateFireGate(true, 1205, off.lastFiredAt, 100)
    expect(backOn.shouldFire).toBe(true) // fires immediately despite only 5 ms passing
  })

  it('treats a non-positive repeat interval as "every tick"', () => {
    const g = evaluateFireGate(true, 500, 500, 0)
    expect(g.shouldFire).toBe(true)
  })
})

describe('boundingRect', () => {
  it('wraps a single point in a 1×1 rect', () => {
    expect(boundingRect([{ x: 10, y: 20 }])).toEqual({ x: 10, y: 20, width: 1, height: 1 })
  })

  it('spans all points inclusively', () => {
    expect(
      boundingRect([
        { x: 100, y: 50 },
        { x: 40, y: 90 },
        { x: 70, y: 10 }
      ])
    ).toEqual({ x: 40, y: 10, width: 61, height: 81 })
  })
})

describe('trigger readiness', () => {
  const positions: ClickPosition[] = [{ id: 'cp1', x: 1, y: 2, button: 'left', delayMs: null }]
  const base: DetectionTrigger = {
    id: 't1',
    enabled: true,
    mode: 'color',
    x: 10,
    y: 20,
    color: '#00ff00',
    tolerance: 25,
    repeatMs: 100,
    image: null,
    searchArea: null,
    action: { kind: 'key', key: 'f', positionId: '' }
  }

  it('a picked color + bound key is ready with no issue', () => {
    expect(isTriggerReady(base, positions)).toBe(true)
    expect(triggerIssue(base, positions)).toBeNull()
  })

  it('is not ready before a pixel is picked', () => {
    const t = { ...base, color: '' }
    expect(isTriggerReady(t, positions)).toBe(false)
    expect(triggerIssue(t, positions)).toMatch(/no pixel picked/i)
  })

  it('is not ready before an image is captured (image mode)', () => {
    const t: DetectionTrigger = { ...base, mode: 'image', image: null }
    expect(isTriggerReady(t, positions)).toBe(false)
    expect(triggerIssue(t, positions)).toMatch(/no image captured/i)
  })

  it('is ready in image mode once a template exists', () => {
    const t: DetectionTrigger = { ...base, mode: 'image', image: 'data:image/png;base64,x' }
    expect(isTriggerReady(t, positions)).toBe(true)
  })

  it('is not ready with an unbound key action', () => {
    const t: DetectionTrigger = { ...base, action: { kind: 'key', key: '  ', positionId: '' } }
    expect(isTriggerReady(t, positions)).toBe(false)
    expect(triggerIssue(t, positions)).toMatch(/no key bound/i)
  })

  it('mouse actions are always ready', () => {
    const t: DetectionTrigger = { ...base, action: { kind: 'mouse-left', key: '', positionId: '' } }
    expect(isTriggerReady(t, positions)).toBe(true)
  })

  it('position actions need an existing saved position', () => {
    const ok: DetectionTrigger = { ...base, action: { kind: 'position', key: '', positionId: 'cp1' } }
    const gone: DetectionTrigger = { ...base, action: { kind: 'position', key: '', positionId: 'zz' } }
    expect(isTriggerReady(ok, positions)).toBe(true)
    expect(isTriggerReady(gone, positions)).toBe(false)
    expect(triggerIssue(gone, positions)).toMatch(/no longer exists/i)
  })

  it('a switched-off trigger is never ready', () => {
    expect(isTriggerReady({ ...base, enabled: false }, positions)).toBe(false)
  })
})

describe('findTemplate', () => {
  const R = [255, 0, 0]
  const G = [0, 255, 0]
  const B = [0, 0, 255]
  const W = [255, 255, 255]

  it('finds an exact sub-image anywhere in the haystack', () => {
    const hay = image([
      [W, W, W, W],
      [W, R, G, W],
      [W, B, W, W],
      [W, W, W, W]
    ])
    const needle = image([
      [R, G],
      [B, W]
    ])
    expect(findTemplate(hay, needle, 0)).toBe(true)
  })

  it('misses when the pattern is not present', () => {
    const hay = image([
      [W, W, W],
      [W, R, W],
      [W, W, W]
    ])
    const needle = image([[G]])
    expect(findTemplate(hay, needle, 0)).toBe(false)
  })

  it('respects the tolerance for near-matches', () => {
    const hay = solid(6, 6, [100, 100, 100])
    const near = solid(2, 2, [108, 95, 100])
    expect(findTemplate(hay, near, 4)).toBe(false)
    expect(findTemplate(hay, near, 8)).toBe(true)
  })

  it('matches at the bottom-right corner (inclusive bounds)', () => {
    const hay = image([
      [W, W, W],
      [W, W, R],
      [W, G, B]
    ])
    const needle = image([
      [W, R],
      [G, B]
    ])
    expect(findTemplate(hay, needle, 0)).toBe(true)
  })

  it('rejects a needle larger than the haystack or empty', () => {
    const hay = solid(2, 2, W)
    expect(findTemplate(hay, solid(3, 2, W), 0)).toBe(false)
    expect(findTemplate(hay, { width: 0, height: 0, data: new Uint8Array(0) }, 0)).toBe(false)
  })

  it('handles a large template (probe + full verification path)', () => {
    // 40×30 haystack with a 20×12 patterned template embedded at (13, 9).
    const pattern = (x: number, y: number): number[] => [(x * 7 + y * 13) % 256, (x * 3) % 256, (y * 5) % 256]
    const hayPixels = Array.from({ length: 30 }, (_, y) =>
      Array.from({ length: 40 }, (_, x) => [200, 200, 200] as number[])
    )
    const needlePixels = Array.from({ length: 12 }, (_, y) =>
      Array.from({ length: 20 }, (_, x) => pattern(x, y))
    )
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 20; x++) hayPixels[y + 9][x + 13] = pattern(x, y)
    }
    expect(findTemplate(image(hayPixels), image(needlePixels), 0)).toBe(true)
    // A single flipped pixel breaks the exact match.
    needlePixels[11][19] = [1, 2, 3]
    expect(findTemplate(image(hayPixels), image(needlePixels), 0)).toBe(false)
  })
})

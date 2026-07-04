// Pure pixel/template matching + trigger-readiness checks for the Detection
// triggers feature. No Electron or native imports, so it's unit-testable and
// shared by the engine and the screen-capture glue in detection.ts.

import type { DetectionTrigger, DetectionAction, DetectionRect, ClickPosition } from '@shared/types'

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

/**
 * Smallest rectangle containing every point. Screen grabs have a large fixed
 * cost (~20 ms BitBlt) regardless of size, so all watched pixels are read from
 * ONE bounding-box grab per tick instead of one grab per pixel.
 */
export function boundingRect(points: Array<{ x: number; y: number }>): DetectionRect {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

// ---------------------------------------------------------------------------
// Repeat-while-true firing gate (level-triggered, not edge-triggered).
//
// A trigger fires the instant its condition becomes true, then keeps re-firing
// every `repeatMs` for as long as it stays true — so a press that didn't "take"
// (stunned, mid-cast, GCD) keeps retrying and lands the moment the character can
// act. When the condition goes false the gate re-arms, so the next rising edge
// fires immediately again. `lastFiredAt` starts at -Infinity to force that first
// fire regardless of the clock.
// ---------------------------------------------------------------------------
export const NEVER_FIRED = Number.NEGATIVE_INFINITY

export interface FireGate {
  /** Whether to fire the action on this tick. */
  shouldFire: boolean
  /** The `lastFiredAt` to carry into the next tick. */
  lastFiredAt: number
}

/**
 * Decide whether a watched trigger should fire this tick given the current
 * match state and when it last fired. Pure, so the repeat cadence is unit-
 * tested without touching the screen or a timer.
 */
export function evaluateFireGate(
  matched: boolean,
  now: number,
  lastFiredAt: number,
  repeatMs: number
): FireGate {
  if (!matched) return { shouldFire: false, lastFiredAt: NEVER_FIRED } // re-arm
  if (now - lastFiredAt >= Math.max(0, repeatMs)) return { shouldFire: true, lastFiredAt: now }
  return { shouldFire: false, lastFiredAt }
}

// ---------------------------------------------------------------------------
// Trigger readiness — a trigger only runs when BOTH halves are set up: the
// condition (a picked color / captured image) and a usable action. Anything
// less must be reported, never silently skipped.
// ---------------------------------------------------------------------------

/** Is the watch half configured (picked pixel color / captured template)? */
export function conditionReady(t: DetectionTrigger): boolean {
  if (t.mode === 'color') return hexToRgb(t.color) !== null
  return typeof t.image === 'string' && t.image !== ''
}

/** Is the act half configured (bound key / existing saved position)? */
export function actionReady(a: DetectionAction, positions: ClickPosition[]): boolean {
  switch (a.kind) {
    case 'key':
      return a.key.trim() !== ''
    case 'mouse-left':
    case 'mouse-right':
      return true
    case 'position':
      return positions.some((p) => p.id === a.positionId)
  }
}

/** Fully runnable: switched on with both halves configured. */
export function isTriggerReady(t: DetectionTrigger, positions: ClickPosition[]): boolean {
  return t.enabled && conditionReady(t) && actionReady(t.action, positions)
}

/**
 * Human-readable reason a switched-on trigger can't run, or null when it can.
 * Shown as a toast at run start and inline in the trigger's row.
 */
export function triggerIssue(t: DetectionTrigger, positions: ClickPosition[]): string | null {
  if (!conditionReady(t)) {
    return t.mode === 'color' ? 'no pixel picked yet' : 'no image captured yet'
  }
  if (!actionReady(t.action, positions)) {
    return t.action.kind === 'key'
      ? 'no key bound for its action'
      : 'its saved click position no longer exists'
  }
  return null
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

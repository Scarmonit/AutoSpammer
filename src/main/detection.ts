// Screen-side of the Detection triggers feature: pixel/region capture helpers
// (used by the pick flows) and the DetectionRunner that polls the screen during
// a run and fires a trigger's action while its condition matches.

import { screen as nutScreen, Point, Region } from '@nut-tree-fork/nut-js'
import { nativeImage } from 'electron'
import type {
  ClickPosition,
  DetectionConfig,
  DetectionRect,
  DetectionTrigger,
  DetectionProbeResult
} from '@shared/types'
import { DETECTION_POLL_MIN_MS, DETECTION_POLL_MAX_MS, DETECTION_POLL_DEFAULT_MS } from '@shared/profileio'
import {
  hexToRgb,
  rgbToHex,
  colorWithinTolerance,
  findTemplate,
  isTriggerReady,
  triggerIssue,
  type RawImage,
  type Rgb
} from './detectmatch'
import { tapBinding, clickAt } from './input'

export { isTriggerReady } from './detectmatch'

/** Captured templates are clamped to this size; bigger regions get cropped. */
export const MAX_TEMPLATE_SIZE = 256

/** The color under a screen pixel, as '#rrggbb'. */
export async function pixelColorAt(x: number, y: number): Promise<string> {
  const c = await nutScreen.colorAt(new Point(x, y))
  return rgbToHex(c.R, c.G, c.B)
}

/** Keep a rect inside the primary display so grabRegion never throws. */
async function clampToScreen(rect: DetectionRect): Promise<DetectionRect | null> {
  const sw = await nutScreen.width()
  const sh = await nutScreen.height()
  const x = Math.min(Math.max(rect.x, 0), sw - 1)
  const y = Math.min(Math.max(rect.y, 0), sh - 1)
  const width = Math.min(rect.width - (x - rect.x), sw - x)
  const height = Math.min(rect.height - (y - rect.y), sh - y)
  if (width < 1 || height < 1) return null
  return { x, y, width, height }
}

/**
 * Grab a screen region as a tightly packed BGRA bitmap. nut-js images can be
 * 3-channel and/or row-padded (byteWidth), so both are normalised here.
 */
async function grabRaw(rect: DetectionRect): Promise<RawImage> {
  const img = await nutScreen.grabRegion(new Region(rect.x, rect.y, rect.width, rect.height))
  const { width, height, channels, byteWidth } = img
  const src = img.data
  const out = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    let so = y * byteWidth
    let oo = y * width * 4
    for (let x = 0; x < width; x++, so += channels, oo += 4) {
      out[oo] = src[so] // B
      out[oo + 1] = src[so + 1] // G
      out[oo + 2] = src[so + 2] // R
      out[oo + 3] = 255
    }
  }
  return { width, height, data: out }
}

/**
 * Capture a screen region as a PNG data URL for storage in the profile. The
 * region is clamped to the primary display and to MAX_TEMPLATE_SIZE (top-left
 * anchored) so templates stay fast to match and small to persist.
 */
export async function captureTemplate(
  rect: DetectionRect
): Promise<{ image: string; rect: DetectionRect } | null> {
  const onScreen = await clampToScreen(rect)
  if (!onScreen) return null
  const clamped: DetectionRect = {
    ...onScreen,
    width: Math.min(onScreen.width, MAX_TEMPLATE_SIZE),
    height: Math.min(onScreen.height, MAX_TEMPLATE_SIZE)
  }
  const raw = await grabRaw(clamped)
  const img = nativeImage.createFromBitmap(Buffer.from(raw.data.buffer), {
    width: raw.width,
    height: raw.height
  })
  return { image: img.toDataURL(), rect: clamped }
}

/** Decode a stored PNG data URL back to raw BGRA pixels. Null when invalid. */
function decodeTemplate(dataUrl: string): RawImage | null {
  try {
    const img = nativeImage.createFromDataURL(dataUrl)
    if (img.isEmpty()) return null
    const { width, height } = img.getSize()
    const data = new Uint8Array(img.toBitmap()) // tightly packed BGRA
    if (data.length < width * height * 4) return null
    return { width, height, data }
  } catch {
    return null
  }
}

/** A trigger with everything pre-resolved for fast per-tick evaluation. */
interface ResolvedTrigger {
  mode: 'color' | 'image'
  x: number
  y: number
  rgb: Rgb | null
  tolerance: number
  needle: RawImage | null
  searchArea: DetectionRect | null
  fire: () => Promise<void>
}

/** Does a resolved trigger's condition match the screen right now? */
async function evaluateTrigger(t: Omit<ResolvedTrigger, 'fire'>): Promise<boolean> {
  if (t.mode === 'color') {
    if (!t.rgb) return false
    const c = await nutScreen.colorAt(new Point(t.x, t.y))
    return colorWithinTolerance({ r: c.R, g: c.G, b: c.B }, t.rgb, t.tolerance)
  }
  if (!t.needle) return false
  const area = t.searchArea
    ? await clampToScreen(t.searchArea)
    : { x: 0, y: 0, width: await nutScreen.width(), height: await nutScreen.height() }
  if (!area) return false
  const hay = await grabRaw(area)
  return findTemplate(hay, t.needle, t.tolerance)
}

/** Map a trigger's action to a fire function, or null when it's unset. */
function resolveAction(
  trigger: DetectionTrigger,
  positions: ClickPosition[]
): (() => Promise<void>) | null {
  const a = trigger.action
  switch (a.kind) {
    case 'key':
      return a.key.trim() !== '' ? (): Promise<void> => tapBinding(a.key.trim()) : null
    case 'mouse-left':
      return (): Promise<void> => tapBinding('mouse-left')
    case 'mouse-right':
      return (): Promise<void> => tapBinding('mouse-right')
    case 'position': {
      const pos = positions.find((p) => p.id === a.positionId)
      return pos ? (): Promise<void> => clickAt(pos.x, pos.y, pos.button) : null
    }
  }
}

/**
 * Live "what does detection see right now?" snapshot for the card UI: one
 * result per trigger with the current pixel color (color mode), whether the
 * condition matches, and any setup issue. Never throws — capture errors show
 * up as an issue string on the affected trigger.
 */
export async function probeTriggers(
  config: DetectionConfig,
  positions: ClickPosition[]
): Promise<DetectionProbeResult[]> {
  const out: DetectionProbeResult[] = []
  for (const t of config.triggers ?? []) {
    const issue = t.enabled ? triggerIssue(t, positions) : null
    const result: DetectionProbeResult = {
      id: t.id,
      matched: false,
      currentColor: null,
      issue
    }
    try {
      if (t.mode === 'color' && Number.isFinite(t.x) && Number.isFinite(t.y)) {
        const c = await nutScreen.colorAt(new Point(t.x, t.y))
        result.currentColor = rgbToHex(c.R, c.G, c.B)
        const rgb = hexToRgb(t.color)
        result.matched =
          rgb !== null && colorWithinTolerance({ r: c.R, g: c.G, b: c.B }, rgb, t.tolerance)
      } else if (t.mode === 'image' && t.image) {
        const needle = decodeTemplate(t.image)
        result.matched =
          needle !== null &&
          (await evaluateTrigger({
            mode: 'image',
            x: t.x,
            y: t.y,
            rgb: null,
            tolerance: t.tolerance,
            needle,
            searchArea: t.searchArea
          }))
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      result.issue = `can't read the screen there (${detail}) — is that spot on your primary monitor?`
    }
    out.push(result)
  }
  return out
}

/**
 * Polls the watched pixels/regions for the duration of a run. Ticks are
 * strictly sequential (the next one is scheduled only after the previous one
 * finishes), so a slow screen grab can never stack up and peg the CPU — the
 * configured interval is the pause BETWEEN checks.
 */
export class DetectionRunner {
  private stopped = false
  private timer: NodeJS.Timeout | null = null
  private triggers: ResolvedTrigger[] = []
  private readonly pollMs: number
  private errorReported = false

  constructor(
    config: DetectionConfig,
    positions: ClickPosition[],
    private readonly onError: (message: string) => void
  ) {
    this.pollMs = Number.isFinite(config.pollMs)
      ? Math.min(DETECTION_POLL_MAX_MS, Math.max(DETECTION_POLL_MIN_MS, Math.round(config.pollMs)))
      : DETECTION_POLL_DEFAULT_MS
    for (const t of config.triggers ?? []) {
      if (!isTriggerReady(t, positions)) continue
      const fire = resolveAction(t, positions)
      if (!fire) continue // unreachable after isTriggerReady, but stay safe
      this.triggers.push({
        mode: t.mode,
        x: t.x,
        y: t.y,
        rgb: hexToRgb(t.color),
        tolerance: t.tolerance,
        needle: t.mode === 'image' && t.image ? decodeTemplate(t.image) : null,
        searchArea: t.searchArea,
        fire
      })
    }
  }

  /** Anything to actually watch (ready triggers with a usable action)? */
  hasWork(): boolean {
    return this.triggers.length > 0
  }

  start(): void {
    if (this.stopped || !this.hasWork()) return
    this.timer = setTimeout(() => void this.tick(), this.pollMs)
  }

  stop(): void {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private async tick(): Promise<void> {
    for (const t of this.triggers) {
      if (this.stopped) return
      try {
        if (await evaluateTrigger(t)) await t.fire()
      } catch (err) {
        // Report the first failure (e.g. capture denied), keep the run alive.
        if (!this.errorReported) {
          this.errorReported = true
          const detail = err instanceof Error ? err.message : String(err)
          this.onError(`Detection trigger check failed: ${detail}`)
        }
      }
    }
    if (!this.stopped) this.timer = setTimeout(() => void this.tick(), this.pollMs)
  }
}

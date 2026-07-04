// Screen-side of the Detection triggers feature: pixel/region capture helpers
// (used by the pick flows) and the DetectionRunner that polls the screen during
// a run and fires a trigger's action while its condition matches.

import { screen as nutScreen, Region } from '@nut-tree-fork/nut-js'
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
  boundingRect,
  evaluateFireGate,
  isTriggerReady,
  triggerIssue,
  NEVER_FIRED,
  type RawImage,
  type Rgb
} from './detectmatch'
import { DETECTION_REPEAT_MIN_MS, DETECTION_REPEAT_MAX_MS, DETECTION_REPEAT_DEFAULT_MS } from '@shared/profileio'
import { tapBinding, clickAt } from './input'

export { isTriggerReady } from './detectmatch'

/** Captured templates are clamped to this size; bigger regions get cropped. */
export const MAX_TEMPLATE_SIZE = 256

/**
 * Read several screen pixels with ONE region grab. A grab's cost is dominated
 * by a fixed ~20 ms BitBlt regardless of size (nut-js's own colorAt grabs the
 * WHOLE screen per pixel — ~120 ms each), so all watched pixels are read from
 * a single bounding-box capture. Points off the primary display return null.
 */
export async function readPixels(points: Array<{ x: number; y: number }>): Promise<Array<Rgb | null>> {
  if (points.length === 0) return []
  const area = await clampToScreen(boundingRect(points))
  if (!area) return points.map(() => null)
  const raw = await grabRaw(area)
  return points.map((p) => {
    const dx = p.x - area.x
    const dy = p.y - area.y
    if (dx < 0 || dy < 0 || dx >= raw.width || dy >= raw.height) return null
    const o = (dy * raw.width + dx) * 4
    return { r: raw.data[o + 2], g: raw.data[o + 1], b: raw.data[o] }
  })
}

/** The color under a screen pixel, as '#rrggbb'. */
export async function pixelColorAt(x: number, y: number): Promise<string> {
  const [rgb] = await readPixels([{ x, y }])
  if (!rgb) throw new Error('that spot is outside the primary display')
  return rgbToHex(rgb.r, rgb.g, rgb.b)
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

/** Fields shared by every resolved watch: its action + repeat-while-true state. */
interface WatchBase {
  tolerance: number
  /** Re-fire interval (ms) while the condition holds. */
  repeatMs: number
  /** When this watch last fired (ms epoch); NEVER_FIRED until the first fire. */
  lastFiredAt: number
  fire: () => Promise<void>
}

/** A color-mode trigger, pre-resolved: watch one pixel, fire on match. */
interface ColorWatch extends WatchBase {
  x: number
  y: number
  rgb: Rgb
}

/** An image-mode trigger, pre-resolved: search for the template, fire on hit. */
interface ImageWatch extends WatchBase {
  needle: RawImage
  searchArea: DetectionRect | null
}

/** Clamp a trigger's stored repeat interval into the allowed range. */
function clampRepeatMs(ms: number): number {
  return Number.isFinite(ms)
    ? Math.min(DETECTION_REPEAT_MAX_MS, Math.max(DETECTION_REPEAT_MIN_MS, Math.round(ms)))
    : DETECTION_REPEAT_DEFAULT_MS
}

/** Is the template visible in its search area (whole screen when unset)? */
async function imageOnScreen(
  needle: RawImage,
  searchArea: DetectionRect | null,
  tolerance: number
): Promise<boolean> {
  const area = searchArea
    ? await clampToScreen(searchArea)
    : { x: 0, y: 0, width: await nutScreen.width(), height: await nutScreen.height() }
  if (!area) return false
  const hay = await grabRaw(area)
  return findTemplate(hay, needle, tolerance)
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
  const triggers = config.triggers ?? []
  const out: DetectionProbeResult[] = triggers.map((t) => ({
    id: t.id,
    matched: false,
    currentColor: null,
    issue: t.enabled ? triggerIssue(t, positions) : null
  }))

  // All color pixels in one grab (same batched read the runner uses).
  const colorIdx = triggers
    .map((_, i) => i)
    .filter((i) => triggers[i].mode === 'color' && Number.isFinite(triggers[i].x) && Number.isFinite(triggers[i].y))
  if (colorIdx.length > 0) {
    try {
      const colors = await readPixels(colorIdx.map((i) => ({ x: triggers[i].x, y: triggers[i].y })))
      colorIdx.forEach((ti, k) => {
        const c = colors[k]
        if (!c) {
          out[ti].issue = "can't read the screen there — is that spot on your primary monitor?"
          return
        }
        out[ti].currentColor = rgbToHex(c.r, c.g, c.b)
        const rgb = hexToRgb(triggers[ti].color)
        out[ti].matched = rgb !== null && colorWithinTolerance(c, rgb, triggers[ti].tolerance)
      })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      for (const ti of colorIdx) out[ti].issue = `can't read the screen (${detail})`
    }
  }

  // Image triggers each grab their own (search) area.
  for (let i = 0; i < triggers.length; i++) {
    const t = triggers[i]
    if (t.mode !== 'image' || !t.image) continue
    try {
      const needle = decodeTemplate(t.image)
      out[i].matched = needle !== null && (await imageOnScreen(needle, t.searchArea, t.tolerance))
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      out[i].issue = `can't read the screen there (${detail}) — is that area on your primary monitor?`
    }
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
  private colors: ColorWatch[] = []
  private images: ImageWatch[] = []
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
      const repeatMs = clampRepeatMs(t.repeatMs)
      if (t.mode === 'color') {
        const rgb = hexToRgb(t.color)
        if (rgb) {
          this.colors.push({ x: t.x, y: t.y, rgb, tolerance: t.tolerance, repeatMs, lastFiredAt: NEVER_FIRED, fire })
        }
      } else {
        const needle = t.image ? decodeTemplate(t.image) : null
        if (needle) {
          this.images.push({
            needle,
            searchArea: t.searchArea,
            tolerance: t.tolerance,
            repeatMs,
            lastFiredAt: NEVER_FIRED,
            fire
          })
        }
      }
    }
  }

  /** Anything to actually watch (ready triggers with a usable action)? */
  hasWork(): boolean {
    return this.colors.length > 0 || this.images.length > 0
  }

  start(): void {
    if (this.stopped || !this.hasWork()) return
    // First check right away — a condition that's already true fires without
    // waiting a full interval.
    this.timer = setTimeout(() => void this.tick(), 0)
  }

  stop(): void {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private async tick(): Promise<void> {
    // Every watched pixel is read from one screen grab, so per-tick cost stays
    // flat (~one BitBlt) no matter how many color triggers there are.
    if (this.colors.length > 0) {
      try {
        const pixels = await readPixels(this.colors)
        for (let i = 0; i < this.colors.length; i++) {
          if (this.stopped) return
          const c = pixels[i]
          const w = this.colors[i]
          const matched = !!c && colorWithinTolerance(c, w.rgb, w.tolerance)
          await this.applyGate(w, matched)
        }
      } catch (err) {
        this.reportOnce(err)
      }
    }
    for (const w of this.images) {
      if (this.stopped) return
      try {
        const matched = await imageOnScreen(w.needle, w.searchArea, w.tolerance)
        await this.applyGate(w, matched)
      } catch (err) {
        this.reportOnce(err)
      }
    }
    if (!this.stopped) this.timer = setTimeout(() => void this.tick(), this.pollMs)
  }

  /**
   * Fire the watch's action if it's due: immediately on the rising edge, then
   * every `repeatMs` while the condition holds; re-arm when it goes false.
   */
  private async applyGate(w: WatchBase, matched: boolean): Promise<void> {
    const gate = evaluateFireGate(matched, Date.now(), w.lastFiredAt, w.repeatMs)
    w.lastFiredAt = gate.lastFiredAt
    if (gate.shouldFire) await w.fire()
  }

  /** Report the first failure (e.g. capture denied), keep the run alive. */
  private reportOnce(err: unknown): void {
    if (this.errorReported) return
    this.errorReported = true
    const detail = err instanceof Error ? err.message : String(err)
    this.onError(`Detection trigger check failed: ${detail}`)
  }
}

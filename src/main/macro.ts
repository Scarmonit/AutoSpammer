import type { MacroEvent } from '@shared/types'
import { makeId } from '@shared/defaults'
import { keyDownName, keyUpName, mouseMove, mouseButtonDown, mouseButtonUp } from './input'

type MouseButton = 'left' | 'right' | 'middle'

/** Throttle for mouse-move sampling (ms). Keeps macros from exploding in size. */
const MOVE_SAMPLE_MS = 15
/** Hard cap so a runaway recording can't grow without bound. */
const MAX_EVENTS = 50000

/** Modifier flags of the hotkey used to stop a recording (its keys are dropped). */
export interface StopCombo {
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
}

/**
 * Captures raw keyboard + mouse events into a replayable macro. Timing is stored
 * as a per-event "delay before this event" so individual gaps can be edited later.
 * Auto-repeat key-downs are de-duplicated, mouse-moves are throttled, and any
 * still-held inputs are cleanly released (or, for the stop hotkey's own modifiers,
 * dropped) when recording stops — so playback never leaves a key stuck down.
 */
export class MacroRecorder {
  private recording = false
  private events: MacroEvent[] = []
  private lastTs = 0
  private lastMoveTs = 0
  private lastX = 0
  private lastY = 0
  private downKeys = new Map<string, MacroEvent>()
  private downButtons = new Map<MouseButton, MacroEvent>()

  isRecording(): boolean {
    return this.recording
  }

  start(): void {
    this.recording = true
    this.events = []
    this.lastTs = 0
    this.lastMoveTs = 0
    this.downKeys.clear()
    this.downButtons.clear()
  }

  keyDown(name: string): void {
    if (!this.canRecord()) return
    if (this.downKeys.has(name)) return // ignore OS auto-repeat
    const ev: MacroEvent = { id: makeId('mev'), type: 'key-down', delayMs: this.nextDelay(), key: name }
    this.events.push(ev)
    this.downKeys.set(name, ev)
  }

  keyUp(name: string): void {
    if (!this.canRecord()) return
    this.downKeys.delete(name)
    this.events.push({ id: makeId('mev'), type: 'key-up', delayMs: this.nextDelay(), key: name })
  }

  mouseDown(button: MouseButton, x: number, y: number): void {
    if (!this.canRecord()) return
    this.lastX = x
    this.lastY = y
    const ev: MacroEvent = {
      id: makeId('mev'),
      type: 'mouse-down',
      delayMs: this.nextDelay(),
      button,
      x: Math.round(x),
      y: Math.round(y)
    }
    this.events.push(ev)
    this.downButtons.set(button, ev)
  }

  mouseUp(button: MouseButton, x: number, y: number): void {
    if (!this.canRecord()) return
    this.lastX = x
    this.lastY = y
    this.downButtons.delete(button)
    this.events.push({
      id: makeId('mev'),
      type: 'mouse-up',
      delayMs: this.nextDelay(),
      button,
      x: Math.round(x),
      y: Math.round(y)
    })
  }

  mouseMove(x: number, y: number): void {
    if (!this.canRecord()) return
    const now = Date.now()
    // Throttle, but always keep the first event's timing reference intact.
    if (this.lastTs !== 0 && now - this.lastMoveTs < MOVE_SAMPLE_MS) return
    this.lastMoveTs = now
    this.lastX = x
    this.lastY = y
    this.events.push({
      id: makeId('mev'),
      type: 'mouse-move',
      delayMs: this.nextDelay(now),
      x: Math.round(x),
      y: Math.round(y)
    })
  }

  /**
   * Stop recording and return the finished macro. Any modifier keys that were
   * only held to trigger the stop hotkey are dropped; every other still-held key
   * or mouse button gets a closing release event so playback stays balanced.
   */
  stop(stopCombo?: StopCombo): MacroEvent[] {
    this.recording = false

    const comboMods = new Set<string>()
    if (stopCombo?.ctrl) ['ctrl', 'ctrlright', 'control', 'controlright'].forEach((m) => comboMods.add(m))
    if (stopCombo?.alt) ['alt', 'altright'].forEach((m) => comboMods.add(m))
    if (stopCombo?.shift) ['shift', 'shiftright'].forEach((m) => comboMods.add(m))
    if (stopCombo?.meta) ['meta', 'metaleft', 'metaright', 'win'].forEach((m) => comboMods.add(m))

    for (const [name, downEv] of this.downKeys) {
      if (comboMods.has(name)) this.removeEvent(downEv)
      else this.events.push({ id: makeId('mev'), type: 'key-up', delayMs: 0, key: name })
    }
    for (const button of this.downButtons.keys()) {
      this.events.push({
        id: makeId('mev'),
        type: 'mouse-up',
        delayMs: 0,
        button,
        x: Math.round(this.lastX),
        y: Math.round(this.lastY)
      })
    }

    this.downKeys.clear()
    this.downButtons.clear()
    const out = this.events
    this.events = []
    return out
  }

  private canRecord(): boolean {
    return this.recording && this.events.length < MAX_EVENTS
  }

  /** Delay since the previous recorded event (0 for the very first one). */
  private nextDelay(now = Date.now()): number {
    if (this.lastTs === 0) {
      this.lastTs = now
      return 0
    }
    const delta = now - this.lastTs
    this.lastTs = now
    return Math.max(0, delta)
  }

  /** Remove an event while preserving the overall timeline. */
  private removeEvent(ev: MacroEvent): void {
    const i = this.events.indexOf(ev)
    if (i === -1) return
    if (i + 1 < this.events.length) this.events[i + 1].delayMs += ev.delayMs
    this.events.splice(i, 1)
  }
}

interface PlayerCallbacks {
  onStart: () => void
  onStop: () => void
  onError: (message: string) => void
}

/**
 * Replays a macro with its recorded (or edited) timings. Cancellable mid-run via
 * stop(); the global hook is suppressed by the caller while a macro plays so our
 * own synthetic events are never re-recorded or treated as hold triggers.
 */
export class MacroPlayer {
  private playing = false
  private abort = false
  private wake: (() => void) | null = null

  constructor(private readonly cb: PlayerCallbacks) {}

  isPlaying(): boolean {
    return this.playing
  }

  async play(events: MacroEvent[]): Promise<void> {
    if (this.playing) return
    this.playing = true
    this.abort = false
    this.cb.onStart()
    try {
      if (!events || events.length === 0) {
        this.cb.onError('Macro is empty — record something first.')
        return
      }
      for (const ev of events) {
        if (this.abort) break
        await this.sleep(ev.delayMs)
        if (this.abort) break
        await this.fire(ev)
      }
    } catch (err) {
      this.cb.onError(err instanceof Error ? err.message : String(err))
    } finally {
      this.playing = false
      this.wake = null
      this.cb.onStop()
    }
  }

  stop(): void {
    if (!this.playing) return
    this.abort = true
    this.wake?.()
  }

  private async fire(ev: MacroEvent): Promise<void> {
    switch (ev.type) {
      case 'key-down':
        if (ev.key) await keyDownName(ev.key)
        break
      case 'key-up':
        if (ev.key) await keyUpName(ev.key)
        break
      case 'mouse-move':
        await mouseMove(ev.x ?? 0, ev.y ?? 0)
        break
      case 'mouse-down':
        if (ev.x != null && ev.y != null) await mouseMove(ev.x, ev.y)
        await mouseButtonDown(ev.button ?? 'left')
        break
      case 'mouse-up':
        if (ev.x != null && ev.y != null) await mouseMove(ev.x, ev.y)
        await mouseButtonUp(ev.button ?? 'left')
        break
    }
  }

  /** Interruptible sleep — stop() resolves it immediately. */
  private sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.abort || ms <= 0) {
        resolve()
        return
      }
      const timer = setTimeout(() => {
        this.wake = null
        resolve()
      }, ms)
      this.wake = (): void => {
        clearTimeout(timer)
        this.wake = null
        resolve()
      }
    })
  }
}

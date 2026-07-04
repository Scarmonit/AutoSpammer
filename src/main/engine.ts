import type {
  Profile,
  SpamMode,
  StatusPayload,
  ActionKind,
  LoopConfig,
  MacroEvent,
  ClickPosition,
  DetectionConfig
} from '@shared/types'
import {
  pressKey,
  typeText,
  clickMouse,
  clickAt,
  clearSynthetic,
  keyUpName,
  mouseButtonDown,
  mouseButtonUp,
  holdKeyDown,
  releaseKey,
  tapBinding
} from './input'
import { playMacroEvent } from './macro'
import { DetectionRunner } from './detection'
import { isTriggerReady, triggerIssue } from './detectmatch'

interface Fireable {
  kind: ActionKind | 'text' | 'pos-click'
  key: string
  text: string
  delayMs: number
  x?: number
  y?: number
  button?: 'left' | 'right'
}

interface EngineCallbacks {
  onStatus: (status: StatusPayload) => void
  onError: (message: string) => void
}

/** One periodic press: tap `key` every `intervalMs` for the duration of a run. */
interface PeriodicTask {
  key: string
  intervalMs: number
}

/**
 * Side-effects that ride along with a manual run, controlled by the main Start
 * Spam button / toggle hotkey:
 *  - holdKeys: keys/mouse-buttons held DOWN for the whole run.
 *  - periodic: any number of keys/buttons, each tapped on its own interval.
 *  - detection: pixel/image watchers polled for the whole run, each firing its
 *    action while its color/template condition matches.
 */
interface RunAugment {
  holdKeys: string[]
  periodic: PeriodicTask[]
  detection: { config: DetectionConfig; positions: ClickPosition[] } | null
}

const NO_AUGMENT: RunAugment = { holdKeys: [], periodic: [], detection: null }

interface AugmentState {
  held: string[]
  periodicTimers: Array<ReturnType<typeof setInterval>>
  detection: DetectionRunner | null
}

function isMouseHold(key: string): 'left' | 'right' | null {
  if (key === 'mouse-left') return 'left'
  if (key === 'mouse-right') return 'right'
  return null
}

/**
 * Runs the spam loop in the main process (off the renderer's UI thread) as a
 * single cancellable async task. Only one run can be active at a time.
 */
export class SpamEngine {
  private running = false
  private mode: SpamMode | null = null
  private abort = false
  private cyclesDone = 0
  private wake: (() => void) | null = null
  private lastEmit = 0

  constructor(private readonly cb: EngineCallbacks) {}

  isRunning(): boolean {
    return this.running
  }

  getStatus(): StatusPayload {
    return {
      status: this.running ? 'running' : 'idle',
      mode: this.mode,
      cyclesDone: this.cyclesDone
    }
  }

  /**
   * Start a run. `overrideDelayMs` lets the hold modes substitute their own
   * pacing for the profile default. Hold modes ignore the loop config and run
   * until `stop()` is called (on key release).
   */
  start(profile: Profile, mode: SpamMode, overrideDelayMs?: number, focusKey?: string): void {
    if (this.running) return

    // "manual" (Start Spam / F6) and "hold" (Hold-to-Spam key) are both the full
    // spam system — every enabled section runs together. They differ only in how
    // they end: manual obeys the Loop config; hold runs until the key is released.
    const fullSpam = mode === 'manual' || mode === 'hold'

    // Hold Keys Down + Periodic Key ride along with a full-spam run (alongside
    // Keys to Spam or a Macro), and stop when the run stops.
    const aug = fullSpam ? buildAugment(profile) : NO_AUGMENT

    // A switched-on detection trigger that can't run (nothing picked yet, no
    // action bound, missing position) must be called out, never silently skipped.
    if (fullSpam) {
      const warning = detectionSetupWarning(profile)
      if (warning) this.cb.onError(warning)
    }

    // A full-spam run with the macro enabled replays the recording (looped) in
    // place of the keys/positions spam.
    if (fullSpam && profile.macro?.enabled) {
      const events = profile.macro.events ?? []
      if (events.length === 0 && !hasAugment(aug)) {
        this.cb.onError('Macro is enabled but empty — record something first.')
        return
      }
      this.begin(mode)
      if (events.length === 0) void this.runAugmentOnly(aug)
      else void this.runMacroLoop(events, profile.loop, aug, mode)
      return
    }

    let fireables: Fireable[]
    try {
      if (mode === 'focus-hold') {
        fireables = buildFocusFireable(focusKey ?? profile.focusHold.key, profile.focusHold.delayMs)
      } else if (mode === 'right-click-hold') {
        fireables = [
          { kind: 'mouse-right', key: '', text: '', delayMs: profile.rightClickHold.delayMs }
        ]
      } else {
        // manual or hold: the full keys/options/positions/text list (the
        // Hold-to-Spam delay overrides the per-tap pacing for a held run).
        fireables = buildFireables(profile, overrideDelayMs)
      }
    } catch (err) {
      this.cb.onError(err instanceof Error ? err.message : String(err))
      return
    }

    if (fireables.length === 0 && !hasAugment(aug)) {
      const bothOff =
        fullSpam && !profile.options.enableKeys && !profile.options.enableClickPositions
      this.cb.onError(
        bothOff
          ? 'Both “Keys to Spam” and “Click Positions” are disabled — enable at least one to spam.'
          : 'Nothing to spam — add a key or enable an option first.'
      )
      return
    }

    this.begin(mode)
    if (fireables.length === 0) {
      // Only Hold Keys Down / Periodic Key are active — run them until stopped.
      void this.runAugmentOnly(aug)
    } else {
      void this.runLoop(fireables, profile.options.sequenceMode, profile.loop, mode, aug)
    }
  }

  /** Common bookkeeping when a run begins. */
  private begin(mode: SpamMode): void {
    this.running = true
    this.mode = mode
    this.abort = false
    this.cyclesDone = 0
    this.emit(true)
  }

  // -------------------------------------------------------------------------
  // Run augmentations (Hold Keys Down + Periodic Key)
  // -------------------------------------------------------------------------

  /** Hold down keys/mouse-buttons and start the periodic timer. */
  private async beginAugment(aug: RunAugment): Promise<AugmentState> {
    const held: string[] = []
    for (const k of aug.holdKeys) {
      try {
        const mouse = isMouseHold(k)
        if (mouse) {
          await mouseButtonDown(mouse)
          held.push(k)
        } else if (await holdKeyDown(k)) {
          held.push(k)
        }
      } catch {
        /* ignore a key/button we couldn't hold */
      }
    }

    // One independent timer per periodic key/button.
    const periodicTimers = aug.periodic.map((t) =>
      setInterval(() => void tapBinding(t.key), t.intervalMs)
    )

    // Detection triggers poll for the whole run (a single sequential loop).
    let detection: DetectionRunner | null = null
    if (aug.detection) {
      detection = new DetectionRunner(aug.detection.config, aug.detection.positions, (m) =>
        this.cb.onError(m)
      )
      detection.start()
    }
    return { held, periodicTimers, detection }
  }

  /** Release everything beginAugment started. */
  private async endAugment(state: AugmentState): Promise<void> {
    state.detection?.stop()
    for (const timer of state.periodicTimers) clearInterval(timer)
    for (const k of state.held) {
      try {
        const mouse = isMouseHold(k)
        if (mouse) await mouseButtonUp(mouse)
        else await releaseKey(k)
      } catch {
        /* ignore */
      }
    }
  }

  /** A manual run with no taps/macro — just hold keys and/or press periodically. */
  private async runAugmentOnly(aug: RunAugment): Promise<void> {
    const state = await this.beginAugment(aug)
    try {
      await this.waitForAbort()
    } catch (err) {
      this.cb.onError(err instanceof Error ? err.message : String(err))
    } finally {
      await this.endAugment(state)
      this.running = false
      this.mode = null
      this.wake = null
      this.emit(true)
    }
  }

  /** Resolve when stop() is called (used by augment-only runs). */
  private waitForAbort(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.abort) {
        resolve()
        return
      }
      this.wake = (): void => {
        this.wake = null
        resolve()
      }
    })
  }

  stop(): void {
    if (!this.running) return
    this.abort = true
    this.wake?.()
  }

  private async runLoop(
    fireables: Fireable[],
    sequenceMode: boolean,
    loop: LoopConfig,
    mode: SpamMode,
    aug: RunAugment = NO_AUGMENT
  ): Promise<void> {
    const state = await this.beginAugment(aug)
    try {
      let seqIndex = 0
      while (!this.abort) {
        if (sequenceMode) {
          const f = fireables[seqIndex % fireables.length]
          await this.fire(f)
          if (this.abort) break
          await this.sleep(f.delayMs)
          seqIndex += 1
          if (seqIndex % fireables.length === 0) {
            this.cyclesDone += 1
            this.emit()
            if (this.isDone(mode, loop)) break
          }
        } else {
          for (const f of fireables) {
            if (this.abort) break
            await this.fire(f)
            if (this.abort) break
            await this.sleep(f.delayMs)
          }
          if (this.abort) break
          this.cyclesDone += 1
          this.emit()
          if (this.isDone(mode, loop)) break
        }
      }
    } catch (err) {
      this.cb.onError(err instanceof Error ? err.message : String(err))
    } finally {
      await this.endAugment(state)
      this.running = false
      this.mode = null
      this.wake = null
      clearSynthetic() // drop any outstanding synthetic-up accounting
      this.emit(true)
    }
  }

  /**
   * Replay a macro with its recorded per-event delays, looping per the Loop
   * config (a held key/button is tracked so an abort mid-press still releases
   * it — no stuck inputs). Each event's delay is the wait BEFORE it fires.
   * Hold Keys Down / Periodic Key (if any) run for the whole macro run.
   */
  private async runMacroLoop(
    events: MacroEvent[],
    loop: LoopConfig,
    aug: RunAugment = NO_AUGMENT,
    mode: SpamMode = 'manual'
  ): Promise<void> {
    const state = await this.beginAugment(aug)
    const downKeys = new Set<string>()
    const downButtons = new Set<'left' | 'right' | 'middle'>()
    try {
      while (!this.abort) {
        for (const ev of events) {
          if (this.abort) break
          await this.sleep(ev.delayMs)
          if (this.abort) break
          await playMacroEvent(ev)
          // Track held state so stop()/errors can release cleanly.
          if (ev.type === 'key-down' && ev.key) downKeys.add(ev.key)
          else if (ev.type === 'key-up' && ev.key) downKeys.delete(ev.key)
          else if (ev.type === 'mouse-down' && ev.button) downButtons.add(ev.button)
          else if (ev.type === 'mouse-up' && ev.button) downButtons.delete(ev.button)
        }
        if (this.abort) break
        this.cyclesDone += 1
        this.emit()
        // manual obeys Loop; hold loops until released (isDone false for 'hold').
        if (this.isDone(mode, loop)) break
      }
    } catch (err) {
      this.cb.onError(err instanceof Error ? err.message : String(err))
    } finally {
      // Release anything still held (e.g. stopped mid-key-press).
      for (const key of downKeys) {
        try {
          await keyUpName(key)
        } catch {
          /* ignore */
        }
      }
      for (const button of downButtons) {
        try {
          await mouseButtonUp(button)
        } catch {
          /* ignore */
        }
      }
      await this.endAugment(state)
      this.running = false
      this.mode = null
      this.wake = null
      this.emit(true)
    }
  }

  private async fire(f: Fireable): Promise<void> {
    switch (f.kind) {
      case 'key':
        await pressKey(f.key)
        break
      case 'mouse-left':
        await clickMouse('left')
        break
      case 'mouse-right':
        await clickMouse('right')
        break
      case 'text':
        await typeText(f.text)
        break
      case 'pos-click':
        await clickAt(f.x ?? 0, f.y ?? 0, f.button ?? 'left')
        break
    }
  }

  private isDone(mode: SpamMode, loop: LoopConfig): boolean {
    if (mode !== 'manual') return false // hold modes only end on stop()
    switch (loop.mode) {
      case 'forever':
        return false
      case 'once':
        return this.cyclesDone >= 1
      case 'count':
        return this.cyclesDone >= Math.max(1, Math.floor(loop.count))
    }
  }

  /** Interruptible sleep — `stop()` resolves it immediately. */
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
      this.wake = () => {
        clearTimeout(timer)
        this.wake = null
        resolve()
      }
    })
  }

  private emit(force = false): void {
    const now = Date.now()
    if (!force && now - this.lastEmit < 100) return
    this.lastEmit = now
    this.cb.onStatus(this.getStatus())
  }
}

// ---------------------------------------------------------------------------
// Fireable + augmentation construction
// ---------------------------------------------------------------------------
function buildFireables(profile: Profile, overrideDelayMs?: number): Fireable[] {
  const def = overrideDelayMs ?? profile.options.defaultDelayMs
  const out: Fireable[] = []

  // "Enable Keys to Spam" gates the key list plus the spacebar/click options,
  // so disabling it leaves only the click positions (and vice-versa).
  if (profile.options.enableKeys) {
    for (const e of profile.entries) {
      out.push({
        kind: e.kind,
        key: e.key,
        text: '',
        delayMs: e.delayMs ?? def
      })
    }

    if (profile.options.spacebar) out.push({ kind: 'key', key: 'space', text: '', delayMs: def })
    if (profile.options.leftClick) out.push({ kind: 'mouse-left', key: '', text: '', delayMs: def })
    if (profile.options.rightClick) out.push({ kind: 'mouse-right', key: '', text: '', delayMs: def })
  }

  if (profile.options.enableClickPositions) {
    for (const p of profile.clickPositions ?? []) {
      out.push({
        kind: 'pos-click',
        key: '',
        text: '',
        x: p.x,
        y: p.y,
        button: p.button,
        delayMs: p.delayMs ?? def
      })
    }
  }

  const tf = profile.textFunction
  if (tf.enabled && tf.text.length > 0) {
    out.push({ kind: 'text', key: '', text: tf.text, delayMs: tf.delayMs })
  }

  return out
}

/** The non-empty Hold Keys Down list (keys + mouse buttons), or [] when off. */
function activeHoldKeys(profile: Profile): string[] {
  if (!profile.holdKeys?.enabled) return []
  return (profile.holdKeys.keys ?? []).filter((k) => k.trim() !== '')
}

/** Build the manual-run augmentation (Hold Keys Down + Periodic Key + Detection). */
function buildAugment(profile: Profile): RunAugment {
  const holdKeys = activeHoldKeys(profile)
  const pk = profile.periodicKey
  const periodic: PeriodicTask[] = pk?.enabled
    ? (pk.entries ?? [])
        .filter((e) => (e.key ?? '').trim() !== '')
        .map((e) => ({
          key: e.key.trim(),
          intervalMs: Math.max(100, Math.round((e.intervalSec || 0) * 1000))
        }))
    : []
  const det = profile.detection
  const positions = profile.clickPositions ?? []
  const detection =
    det?.enabled && (det.triggers ?? []).some((t) => isTriggerReady(t, positions))
      ? { config: det, positions }
      : null
  return { holdKeys, periodic, detection }
}

/** Message for the first switched-on detection trigger that can't run, if any. */
function detectionSetupWarning(profile: Profile): string | null {
  const det = profile.detection
  if (!det?.enabled) return null
  const positions = profile.clickPositions ?? []
  const triggers = det.triggers ?? []
  for (let i = 0; i < triggers.length; i++) {
    const t = triggers[i]
    if (!t.enabled) continue
    const issue = triggerIssue(t, positions)
    if (issue) return `Detection trigger #${i + 1} won't run: ${issue}.`
  }
  return null
}

function hasAugment(aug: RunAugment): boolean {
  return aug.holdKeys.length > 0 || aug.periodic.length > 0 || aug.detection !== null
}

function buildFocusFireable(key: string, delayMs: number): Fireable[] {
  if (!key) return []
  if (key === 'mouse-left') return [{ kind: 'mouse-left', key: '', text: '', delayMs }]
  if (key === 'mouse-right') return [{ kind: 'mouse-right', key: '', text: '', delayMs }]
  return [{ kind: 'key', key, text: '', delayMs }]
}

import type { Profile, SpamMode, StatusPayload, ActionKind, LoopConfig } from '@shared/types'
import { pressKey, typeText, clickMouse } from './input'

interface Fireable {
  kind: ActionKind | 'text'
  key: string
  text: string
  delayMs: number
}

interface EngineCallbacks {
  onStatus: (status: StatusPayload) => void
  onError: (message: string) => void
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

    let fireables: Fireable[]
    try {
      fireables =
        mode === 'focus-hold'
          ? buildFocusFireable(focusKey ?? profile.focusHold.key, profile.focusHold.delayMs)
          : buildFireables(profile, overrideDelayMs)
    } catch (err) {
      this.cb.onError(err instanceof Error ? err.message : String(err))
      return
    }

    if (fireables.length === 0) {
      this.cb.onError('Nothing to spam — add a key or enable an option first.')
      return
    }

    this.running = true
    this.mode = mode
    this.abort = false
    this.cyclesDone = 0
    this.emit(true)

    void this.runLoop(fireables, profile.options.sequenceMode, profile.loop, mode)
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
    mode: SpamMode
  ): Promise<void> {
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
// Fireable construction
// ---------------------------------------------------------------------------
function buildFireables(profile: Profile, overrideDelayMs?: number): Fireable[] {
  const def = overrideDelayMs ?? profile.options.defaultDelayMs
  const out: Fireable[] = []

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

  const tf = profile.textFunction
  if (tf.enabled && tf.text.length > 0) {
    out.push({ kind: 'text', key: '', text: tf.text, delayMs: tf.delayMs })
  }

  return out
}

function buildFocusFireable(key: string, delayMs: number): Fireable[] {
  if (!key) return []
  if (key === 'mouse-left') return [{ kind: 'mouse-left', key: '', text: '', delayMs }]
  if (key === 'mouse-right') return [{ kind: 'mouse-right', key: '', text: '', delayMs }]
  return [{ kind: 'key', key, text: '', delayMs }]
}

import type { Profile, AuxStatus } from '@shared/types'
import { holdKeyDown, releaseKey, tapBinding, mouseButtonDown, mouseButtonUp } from './input'

function isMouseHold(key: string): 'left' | 'right' | null {
  if (key === 'mouse-left') return 'left'
  if (key === 'mouse-right') return 'right'
  return null
}

interface AuxCallbacks {
  getProfile: () => Profile
  onStatus: (s: AuxStatus) => void
  onError: (message: string) => void
}

/**
 * Two auxiliary input modes that run independently of the spam loop:
 *  - Hold Keys Down: press chosen keys and keep them physically held.
 *  - Periodic Key:   press a chosen key once every N seconds.
 * Each is a simple on/off toggle (button or global hotkey).
 */
export class AuxController {
  private holdActive = false
  private periodicActive = false
  private heldKeys: string[] = []
  private periodicTimers: NodeJS.Timeout[] = []

  constructor(private readonly cb: AuxCallbacks) {}

  getStatus(): AuxStatus {
    return { holdActive: this.holdActive, periodicActive: this.periodicActive }
  }

  toggleHold(): void {
    if (this.holdActive) {
      void this.releaseHeld()
      return
    }
    const keys = (this.cb.getProfile().holdKeys.keys ?? []).filter((k) => k.trim() !== '')
    if (keys.length === 0) {
      this.cb.onError('Add at least one key to hold down first.')
      return
    }
    this.holdActive = true
    this.heldKeys = []
    this.cb.onStatus(this.getStatus())
    void this.holdAll(keys)
  }

  private async holdAll(keys: string[]): Promise<void> {
    for (const k of keys) {
      const mouse = isMouseHold(k)
      if (mouse) {
        await mouseButtonDown(mouse)
        this.heldKeys.push(k)
      } else if (await holdKeyDown(k)) {
        this.heldKeys.push(k)
      }
    }
  }

  private async releaseHeld(): Promise<void> {
    const keys = this.heldKeys
    this.heldKeys = []
    this.holdActive = false
    for (const k of keys) {
      const mouse = isMouseHold(k)
      if (mouse) await mouseButtonUp(mouse)
      else await releaseKey(k)
    }
    this.cb.onStatus(this.getStatus())
  }

  togglePeriodic(): void {
    if (this.periodicActive) {
      this.stopPeriodic()
      this.cb.onStatus(this.getStatus())
      return
    }
    const entries = (this.cb.getProfile().periodicKey.entries ?? []).filter(
      (e) => (e.key ?? '').trim() !== ''
    )
    if (entries.length === 0) {
      this.cb.onError('Add a periodic key first.')
      return
    }
    this.periodicActive = true
    // One independent timer per entry.
    this.periodicTimers = entries.map((e) => {
      const ms = Math.max(100, Math.round((e.intervalSec || 0) * 1000))
      return setInterval(() => void tapBinding(e.key.trim()), ms)
    })
    this.cb.onStatus(this.getStatus())
  }

  private stopPeriodic(): void {
    for (const timer of this.periodicTimers) clearInterval(timer)
    this.periodicTimers = []
    this.periodicActive = false
  }

  /** Stop everything and release any held keys (emergency / quit). */
  stopAll(): void {
    this.stopPeriodic()
    if (this.heldKeys.length > 0 || this.holdActive) {
      void this.releaseHeld()
    } else {
      this.cb.onStatus(this.getStatus())
    }
  }
}

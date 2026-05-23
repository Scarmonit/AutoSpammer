import type { Profile, AuxStatus } from '@shared/types'
import { holdKeyDown, releaseKey, pressKey } from './input'

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
  private periodicTimer: NodeJS.Timeout | null = null

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
      const ok = await holdKeyDown(k)
      if (ok) this.heldKeys.push(k)
    }
  }

  private async releaseHeld(): Promise<void> {
    const keys = this.heldKeys
    this.heldKeys = []
    this.holdActive = false
    for (const k of keys) await releaseKey(k)
    this.cb.onStatus(this.getStatus())
  }

  togglePeriodic(): void {
    if (this.periodicActive) {
      this.stopPeriodic()
      this.cb.onStatus(this.getStatus())
      return
    }
    const { key, intervalSec } = this.cb.getProfile().periodicKey
    if (!key || key.trim() === '') {
      this.cb.onError('Choose a key for the periodic press first.')
      return
    }
    const ms = Math.max(100, Math.round((intervalSec || 0) * 1000))
    this.periodicActive = true
    this.periodicTimer = setInterval(() => void pressKey(key), ms)
    this.cb.onStatus(this.getStatus())
  }

  private stopPeriodic(): void {
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer)
      this.periodicTimer = null
    }
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

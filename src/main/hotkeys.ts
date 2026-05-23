import { globalShortcut } from 'electron'
import { uIOhook, type UiohookKeyboardEvent, type UiohookMouseEvent } from 'uiohook-napi'
import type { Profile, AppSettings, RecordedKey, HotkeyConflict, SpamMode } from '@shared/types'
import type { SpamEngine } from './engine'
import { consumeSyntheticUp } from './input'
import { nameForKeycode, keycodeForName } from './keymap'

interface Deps {
  getProfile: () => Profile
  getSettings: () => AppSettings
  engine: SpamEngine
  onRecorded: (rk: RecordedKey) => void
  onConflict: (c: HotkeyConflict) => void
  onRecordPosition: () => void
}

/**
 * Owns every global input listener. There is exactly one uiohook handler set
 * for the lifetime of the app and a single debounced hotkey registration path,
 * so settings updates can never leave duplicate or stale listeners behind.
 */
export class GlobalInput {
  private started = false
  private recording = false
  private registerTimer: NodeJS.Timeout | null = null

  // Token of the physical key currently driving a hold-mode run, plus which
  // mode it started, so we know exactly which key-up should stop the engine.
  private heldToken: string | null = null
  private heldMode: SpamMode | null = null

  constructor(private readonly deps: Deps) {}

  start(): void {
    if (this.started) return
    this.started = true

    uIOhook.on('keydown', (e) => this.onKeyDown(e))
    uIOhook.on('keyup', (e) => this.onKeyUp(e))
    uIOhook.on('mousedown', (e) => this.onMouseDown(e))
    uIOhook.on('mouseup', (e) => this.onMouseUp(e))

    try {
      uIOhook.start()
    } catch (err) {
      // Non-fatal: hold/record features degrade but manual spam still works.
      console.error('[hotkeys] failed to start uiohook:', err)
    }

    this.scheduleRegister()
  }

  dispose(): void {
    if (this.registerTimer) clearTimeout(this.registerTimer)
    globalShortcut.unregisterAll()
    try {
      uIOhook.stop()
    } catch {
      /* ignore */
    }
    this.started = false
  }

  // -------------------------------------------------------------------------
  // Global accelerators (toggle, record-position, emergency)
  // -------------------------------------------------------------------------

  /** Debounced so rapid hotkey edits don't thrash registration. */
  onSettingsChanged(): void {
    this.scheduleRegister()
  }

  private scheduleRegister(): void {
    if (this.registerTimer) clearTimeout(this.registerTimer)
    this.registerTimer = setTimeout(() => {
      this.registerTimer = null
      this.registerHotkeys()
    }, 300)
  }

  /** Re-register the always-on accelerators; emergency is managed by setRunning(). */
  private registerHotkeys(): void {
    const { toggleHotkey, emergencyHotkey, recordPositionHotkey } = this.deps.getSettings()

    for (const accel of this.registered) globalShortcut.unregister(accel)
    this.registered.clear()

    const taken = new Set<string>()
    if (emergencyHotkey) taken.add(emergencyHotkey)

    this.tryRegister('toggleHotkey', toggleHotkey, taken, () => this.toggle())
    this.tryRegister('recordPositionHotkey', recordPositionHotkey, taken, () =>
      this.deps.onRecordPosition()
    )
  }

  private tryRegister(
    field: HotkeyConflict['field'],
    accel: string,
    taken: Set<string>,
    handler: () => void
  ): void {
    if (!accel) return
    if (taken.has(accel)) {
      this.deps.onConflict({
        field,
        accelerator: accel,
        message: `"${accel}" is already assigned to another Auto Spammer hotkey.`
      })
      return
    }
    try {
      if (globalShortcut.register(accel, handler)) {
        this.registered.add(accel)
        taken.add(accel)
      } else {
        this.deps.onConflict({
          field,
          accelerator: accel,
          message: `"${accel}" is already in use by another application.`
        })
      }
    } catch {
      this.deps.onConflict({ field, accelerator: accel, message: `"${accel}" is not a valid hotkey.` })
    }
  }

  private registered = new Set<string>()
  private emergencyRegistered = false

  /**
   * Emergency stop is only captured while spamming, so we don't swallow the
   * Escape key system-wide the rest of the time.
   */
  setRunning(running: boolean): void {
    const { emergencyHotkey } = this.deps.getSettings()
    if (!emergencyHotkey) return
    if (running && !this.emergencyRegistered) {
      try {
        this.emergencyRegistered = globalShortcut.register(emergencyHotkey, () =>
          this.deps.engine.stop()
        )
      } catch {
        this.emergencyRegistered = false
      }
    } else if (!running && this.emergencyRegistered) {
      globalShortcut.unregister(emergencyHotkey)
      this.emergencyRegistered = false
    }
  }

  private toggle(): void {
    if (this.deps.engine.isRunning()) {
      this.deps.engine.stop()
    } else {
      this.deps.engine.start(this.deps.getProfile(), 'manual')
    }
  }

  // -------------------------------------------------------------------------
  // Record mode
  // -------------------------------------------------------------------------
  setRecording(on: boolean): void {
    this.recording = on
  }

  // -------------------------------------------------------------------------
  // Physical hold detection
  // -------------------------------------------------------------------------
  private onKeyDown(e: UiohookKeyboardEvent): void {
    const token = `k:${e.keycode}`
    if (this.recording) {
      this.deps.onRecorded({ kind: 'key', key: nameForKeycode(e.keycode) })
      return
    }
    // Down events need no synthetic filtering: while a run is active the
    // start guard ignores them, and while idle no synthetic input exists.
    this.handleHoldDown(token)
  }

  private onKeyUp(e: UiohookKeyboardEvent): void {
    const token = `k:${e.keycode}`
    if (consumeSyntheticUp(token)) return // our own simulated key-up
    this.handleHoldUp(token)
  }

  private onMouseDown(e: UiohookMouseEvent): void {
    const token = `m:${e.button}`
    if (this.recording) {
      this.deps.onRecorded({ kind: e.button === 2 ? 'mouse-right' : 'mouse-left', key: '' })
      return
    }
    this.handleHoldDown(token)
  }

  private onMouseUp(e: UiohookMouseEvent): void {
    const token = `m:${e.button}`
    if (consumeSyntheticUp(token)) return // our own simulated mouse-up
    this.handleHoldUp(token)
  }

  private handleHoldDown(token: string): void {
    const engine = this.deps.engine
    // Auto-repeat events while already holding, or activity during another run.
    if (engine.isRunning()) return

    const profile = this.deps.getProfile()

    if (profile.focusHold.enabled && tokenFor(profile.focusHold.key) === token) {
      this.heldToken = token
      this.heldMode = 'focus-hold'
      engine.start(profile, 'focus-hold')
      return
    }

    if (profile.holdToSpam.enabled && tokenFor(profile.holdToSpam.key) === token) {
      this.heldToken = token
      this.heldMode = 'hold'
      engine.start(profile, 'hold', profile.holdToSpam.delayMs)
    }
  }

  private handleHoldUp(token: string): void {
    if (this.heldToken === token && this.heldMode) {
      this.heldToken = null
      this.heldMode = null
      this.deps.engine.stop()
    }
  }
}

/** Map a configured hold-key string to the same token format as live events. */
function tokenFor(key: string): string | null {
  if (!key) return null
  if (key === 'mouse-left') return 'm:1'
  if (key === 'mouse-right') return 'm:2'
  const code = keycodeForName(key)
  return code === null ? null : `k:${code}`
}

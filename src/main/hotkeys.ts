import { globalShortcut } from 'electron'
import { uIOhook, type UiohookKeyboardEvent, type UiohookMouseEvent } from 'uiohook-napi'
import type { Profile, AppSettings, RecordedKey, HotkeyConflict, SpamMode } from '@shared/types'
import type { SpamEngine } from './engine'
import { isSyntheticToken } from './input'
import { nameForKeycode, keycodeForName } from './keymap'

interface Deps {
  getProfile: () => Profile
  getSettings: () => AppSettings
  engine: SpamEngine
  onRecorded: (rk: RecordedKey) => void
  onConflict: (c: HotkeyConflict) => void
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

    this.scheduleRegisterToggle()
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
  // Global accelerators (toggle + emergency)
  // -------------------------------------------------------------------------

  /** Debounced so rapid hotkey edits don't thrash registration. */
  onSettingsChanged(): void {
    this.scheduleRegisterToggle()
  }

  private scheduleRegisterToggle(): void {
    if (this.registerTimer) clearTimeout(this.registerTimer)
    this.registerTimer = setTimeout(() => {
      this.registerTimer = null
      this.registerToggle()
    }, 300)
  }

  private registerToggle(): void {
    const { toggleHotkey, emergencyHotkey } = this.deps.getSettings()

    // Re-register only the toggle key; emergency is managed by setRunning().
    globalShortcut.unregister(this.lastToggle ?? toggleHotkey)
    this.lastToggle = toggleHotkey

    if (toggleHotkey && toggleHotkey === emergencyHotkey) {
      this.deps.onConflict({
        field: 'toggleHotkey',
        accelerator: toggleHotkey,
        message: 'Toggle and emergency-stop hotkeys must be different.'
      })
      return
    }

    if (!toggleHotkey) return
    try {
      const ok = globalShortcut.register(toggleHotkey, () => this.toggle())
      if (!ok) {
        this.deps.onConflict({
          field: 'toggleHotkey',
          accelerator: toggleHotkey,
          message: `"${toggleHotkey}" is already in use by another application.`
        })
      }
    } catch {
      this.deps.onConflict({
        field: 'toggleHotkey',
        accelerator: toggleHotkey,
        message: `"${toggleHotkey}" is not a valid hotkey.`
      })
    }
  }

  private lastToggle: string | null = null
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
    if (isSyntheticToken(token)) return
    if (this.recording) {
      this.deps.onRecorded({ kind: 'key', key: nameForKeycode(e.keycode) })
      return
    }
    this.handleHoldDown(token)
  }

  private onKeyUp(e: UiohookKeyboardEvent): void {
    const token = `k:${e.keycode}`
    if (isSyntheticToken(token)) return
    this.handleHoldUp(token)
  }

  private onMouseDown(e: UiohookMouseEvent): void {
    const token = `m:${e.button}`
    if (isSyntheticToken(token)) return
    if (this.recording) {
      this.deps.onRecorded({ kind: e.button === 2 ? 'mouse-right' : 'mouse-left', key: '' })
      return
    }
    this.handleHoldDown(token)
  }

  private onMouseUp(e: UiohookMouseEvent): void {
    const token = `m:${e.button}`
    if (isSyntheticToken(token)) return
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

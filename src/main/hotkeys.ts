import { globalShortcut } from 'electron'
import { uIOhook, type UiohookKeyboardEvent, type UiohookMouseEvent } from 'uiohook-napi'
import type { Profile, AppSettings, RecordedKey, HotkeyConflict, SpamMode } from '@shared/types'
import type { SpamEngine } from './engine'
import { applyHiddenSections } from '@shared/sections'
import { consumeSyntheticUp } from './input'
import {
  nameForKeycode,
  keycodeForName,
  parseAccelerator,
  mouseButtonNumber,
  type ParsedAccelerator
} from './keymap'

type MouseButton = 'left' | 'right' | 'middle'

/** Map a uiohook mouse button number to our logical button name. */
function mouseButtonName(button: unknown): MouseButton {
  return button === 2 ? 'right' : button === 3 ? 'middle' : 'left'
}

interface Deps {
  getProfile: () => Profile
  getSettings: () => AppSettings
  engine: SpamEngine
  onRecorded: (rk: RecordedKey) => void
  onConflict: (c: HotkeyConflict) => void
  onRecordPosition: () => void
  /** A live click captured while click-recording mode is on. */
  onRecordPositionAt: (x: number, y: number, button: 'left' | 'right') => void
  onEmergencyStop: () => void
  /** Is the Auto Spammer window the focused window right now? */
  isAppFocused: () => boolean
  /** Does the given screen point fall inside the (visible) Auto Spammer window? */
  isPointInAppWindow: (x: number, y: number) => boolean
  /** The macro record hotkey was pressed — toggle recording in the main process. */
  onMacroToggleHotkey: () => void
  /** Forward a captured key event while a macro is recording. */
  onMacroKey: (type: 'down' | 'up', name: string) => void
  /** Forward a captured mouse button event while a macro is recording. */
  onMacroMouse: (type: 'down' | 'up', button: MouseButton, x: number, y: number) => void
  /** Forward a captured mouse movement while a macro is recording. */
  onMacroMove: (x: number, y: number) => void
}

/**
 * Owns every global input listener. There is exactly one uiohook handler set
 * for the lifetime of the app and a single debounced hotkey registration path,
 * so settings updates can never leave duplicate or stale listeners behind.
 */
export class GlobalInput {
  private started = false
  private recording = false
  private recordingPositions = false
  private macroRecording = false
  private macroPlaying = false
  private macroHotkey: ParsedAccelerator | null = null
  /** Macro record hotkey when bound to a mouse button (uiohook button number). */
  private macroHotkeyButton: number | null = null
  // Keycodes / mouse buttons whose next up should be swallowed (the macro
  // hotkey's own press, so it never leaks into a recording).
  private suppressUpCodes = new Set<number>()
  private suppressUpButtons = new Set<number>()
  /** Mouse-button hotkeys (toggle / record-position). */
  private mouseHotkeys = new Map<number, () => void>()
  /** Emergency hotkey when bound to a mouse button, plus whether it's armed. */
  private emergencyButton: number | null = null
  private emergencyArmed = false
  private registerTimer: NodeJS.Timeout | null = null
  /** True while the renderer's key-capture overlay is open — no hotkey fires. */
  private captureSuspended = false

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
    uIOhook.on('mousemove', (e) => this.onMouseMove(e))

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

  /**
   * While the key-capture overlay is open, every global hotkey and hold
   * trigger is suspended so the pressed key/button reaches the renderer to be
   * bound — pressing e.g. the start/stop hotkey must not start a run.
   */
  setCaptureSuspended(on: boolean): void {
    if (this.captureSuspended === on) return
    this.captureSuspended = on
    if (on) {
      if (this.registerTimer) {
        clearTimeout(this.registerTimer)
        this.registerTimer = null
      }
      for (const accel of this.registered) globalShortcut.unregister(accel)
      this.registered.clear()
      this.mouseHotkeys.clear()
      this.macroHotkey = null
      this.macroHotkeyButton = null
      this.clearKeyboardEmergency()
    } else {
      this.registerHotkeys() // re-register from the current settings
    }
  }

  private scheduleRegister(): void {
    if (this.registerTimer) clearTimeout(this.registerTimer)
    this.registerTimer = setTimeout(() => {
      this.registerTimer = null
      this.registerHotkeys()
    }, 300)
  }

  /**
   * Re-register the trigger hotkeys. Keyboard bindings use globalShortcut;
   * mouse-button bindings are detected from the raw uiohook stream (globalShortcut
   * can't register mouse). Emergency is (re)applied via applyEmergency().
   */
  private registerHotkeys(): void {
    if (this.captureSuspended) return // re-registered when the capture ends
    const s = this.deps.getSettings()

    // The macro record hotkey is detected via the raw uiohook stream (not a
    // globalShortcut) so we can exclude its own press from the recording.
    this.macroHotkeyButton = mouseButtonNumber(s.macroRecordHotkey)
    this.macroHotkey = this.macroHotkeyButton === null ? parseAccelerator(s.macroRecordHotkey) : null

    for (const accel of this.registered) globalShortcut.unregister(accel)
    this.registered.clear()
    this.mouseHotkeys.clear()

    const taken = new Set<string>()
    if (s.emergencyHotkey) taken.add(s.emergencyHotkey)

    this.registerTrigger('toggleHotkey', s.toggleHotkey, taken, () => this.toggle())
    this.registerTrigger('recordPositionHotkey', s.recordPositionHotkey, taken, () =>
      this.deps.onRecordPosition()
    )
    this.applyEmergency()
  }

  /** Route a trigger to a mouse-button handler or a keyboard globalShortcut. */
  private registerTrigger(
    field: HotkeyConflict['field'],
    value: string,
    taken: Set<string>,
    handler: () => void
  ): void {
    if (!value) return
    const button = mouseButtonNumber(value)
    if (button !== null) {
      this.mouseHotkeys.set(button, handler)
      taken.add(value)
      return
    }
    this.tryRegister(field, value, taken, handler)
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
        message: `"${accel}" is already assigned to another Monit hotkey.`
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
  private emergencyRegisteredAccel: string | null = null

  /**
   * Emergency stop is only captured while something is active (spamming, holding
   * keys, or periodic press), so we don't swallow it system-wide the rest of the
   * time. Re-applied whenever the armed state or the binding changes.
   */
  setEmergencyArmed(armed: boolean): void {
    this.emergencyArmed = armed
    this.applyEmergency()
  }

  /** Reconcile the emergency binding (keyboard globalShortcut vs mouse) + armed. */
  private applyEmergency(): void {
    const { emergencyHotkey } = this.deps.getSettings()
    this.emergencyButton = emergencyHotkey ? mouseButtonNumber(emergencyHotkey) : null

    // Mouse emergency is handled in onMouseDown (gated by this.emergencyArmed);
    // keyboard emergency uses a globalShortcut registered only while armed.
    const wantKeyboard = !!emergencyHotkey && this.emergencyButton === null && this.emergencyArmed
    if (wantKeyboard) {
      if (this.emergencyRegisteredAccel !== emergencyHotkey) {
        this.clearKeyboardEmergency()
        try {
          if (globalShortcut.register(emergencyHotkey, () => this.deps.onEmergencyStop())) {
            this.emergencyRegisteredAccel = emergencyHotkey
          }
        } catch {
          /* ignore */
        }
      }
    } else {
      this.clearKeyboardEmergency()
    }
  }

  private clearKeyboardEmergency(): void {
    if (this.emergencyRegisteredAccel) {
      try {
        globalShortcut.unregister(this.emergencyRegisteredAccel)
      } catch {
        /* ignore */
      }
      this.emergencyRegisteredAccel = null
    }
  }

  private toggle(): void {
    // Don't fight a one-shot macro preview running from the panel.
    if (this.macroPlaying) return
    if (this.deps.engine.isRunning()) {
      this.deps.engine.stop()
    } else {
      // Filter like every other start path, so hidden sections and master
      // Enabled switches (e.g. Hold Actions) are honoured on hotkey starts too.
      this.deps.engine.start(applyHiddenSections(this.deps.getProfile()), 'manual')
    }
  }

  // -------------------------------------------------------------------------
  // Record mode
  // -------------------------------------------------------------------------
  setRecording(on: boolean): void {
    this.recording = on
  }

  /**
   * Continuous click-recording mode: while on, every physical left/right click
   * is saved as a new click position (works even while a game is focused).
   */
  setRecordingPositions(on: boolean): void {
    this.recordingPositions = on
  }

  /** Toggle full macro recording — routes raw input to the macro recorder. */
  setMacroRecording(on: boolean): void {
    this.macroRecording = on
  }

  /** Suppress all global-hook handling while a macro is playing back. */
  setMacroPlaying(on: boolean): void {
    this.macroPlaying = on
  }

  private matchesMacroHotkey(e: UiohookKeyboardEvent): boolean {
    const m = this.macroHotkey
    return (
      m !== null &&
      e.keycode === m.code &&
      e.ctrlKey === m.ctrl &&
      e.altKey === m.alt &&
      e.shiftKey === m.shift &&
      e.metaKey === m.meta
    )
  }

  // -------------------------------------------------------------------------
  // Physical hold detection
  // -------------------------------------------------------------------------
  private onKeyDown(e: UiohookKeyboardEvent): void {
    // A key pressed while the capture overlay is open is being BOUND — it must
    // not trigger recording, macro toggles, or hold-to-run starts. (Key-ups
    // still flow below so an in-flight hold run can end normally.)
    if (this.captureSuspended) return

    // The macro hotkey toggles recording and is never itself recorded. We also
    // swallow its key-up (start or stop) so it can't leak into the macro.
    if (this.matchesMacroHotkey(e)) {
      this.suppressUpCodes.add(e.keycode)
      this.deps.onMacroToggleHotkey()
      return
    }
    if (this.macroPlaying) return

    if (this.macroRecording) {
      // Skip input aimed at our own window (e.g. clicking around the UI).
      if (!this.deps.isAppFocused()) this.deps.onMacroKey('down', nameForKeycode(e.keycode))
      return
    }

    if (this.recording) {
      // Ignore keys typed into our own window (e.g. tabbing around the UI or
      // hitting Space/Enter on the "Stop Recording" button) — only capture keys
      // pressed while another app/game is focused.
      if (this.deps.isAppFocused()) return
      this.deps.onRecorded({ kind: 'key', key: nameForKeycode(e.keycode) })
      return
    }
    // Down events need no synthetic filtering: while a run is active the
    // start guard ignores them, and while idle no synthetic input exists.
    this.handleHoldDown(`k:${e.keycode}`)
  }

  private onKeyUp(e: UiohookKeyboardEvent): void {
    if (this.suppressUpCodes.delete(e.keycode)) return // the macro hotkey's own key-up
    if (this.macroPlaying) return

    if (this.macroRecording) {
      if (!this.deps.isAppFocused()) this.deps.onMacroKey('up', nameForKeycode(e.keycode))
      return
    }

    const token = `k:${e.keycode}`
    if (consumeSyntheticUp(token)) return // our own simulated key-up
    this.handleHoldUp(token)
  }

  private onMouseDown(e: UiohookMouseEvent): void {
    // Same as onKeyDown: buttons pressed during a capture are being bound.
    if (this.captureSuspended) return

    const button = Number(e.button)

    // The macro record hotkey (mouse) toggles recording and is never recorded;
    // swallow its mouse-up too so it can't leak into the macro. Checked first.
    if (this.macroHotkeyButton !== null && button === this.macroHotkeyButton) {
      this.suppressUpButtons.add(button)
      this.deps.onMacroToggleHotkey()
      return
    }
    if (this.macroPlaying) return

    if (this.macroRecording) {
      if (!this.deps.isPointInAppWindow(e.x, e.y)) {
        this.deps.onMacroMouse('down', mouseButtonName(e.button), e.x, e.y)
      }
      return
    }

    if (this.recording || this.recordingPositions) {
      // Ignore clicks that land inside our own window — most importantly the
      // "Stop Recording" button. A coordinate (not focus) test is used because
      // the click that switches focus back to Auto Spammer fires through the
      // global hook *before* the window is marked focused. Only clicks in other
      // windows/games get recorded.
      if (this.deps.isPointInAppWindow(e.x, e.y)) return

      if (this.recording) {
        this.deps.onRecorded({ kind: e.button === 2 ? 'mouse-right' : 'mouse-left', key: '' })
      } else if (e.button === 1 || e.button === 2) {
        // Only left (1) / right (2) clicks become positions; ignore middle etc.
        this.deps.onRecordPositionAt(e.x, e.y, e.button === 2 ? 'right' : 'left')
      }
      return
    }

    // Mouse-button emergency stop (only while something is running).
    if (this.emergencyButton !== null && this.emergencyArmed && button === this.emergencyButton) {
      this.deps.onEmergencyStop()
      return
    }

    // Mouse-button hotkeys (toggle / record-position).
    const hotkey = this.mouseHotkeys.get(button)
    if (hotkey) {
      hotkey()
      return
    }

    this.handleHoldDown(`m:${button}`)
  }

  private onMouseUp(e: UiohookMouseEvent): void {
    if (this.suppressUpButtons.delete(Number(e.button))) return // macro hotkey's own up
    if (this.macroPlaying) return

    if (this.macroRecording) {
      if (!this.deps.isPointInAppWindow(e.x, e.y)) {
        this.deps.onMacroMouse('up', mouseButtonName(e.button), e.x, e.y)
      }
      return
    }

    const token = `m:${e.button}`
    if (consumeSyntheticUp(token)) return // our own simulated mouse-up
    this.handleHoldUp(token)
  }

  private onMouseMove(e: UiohookMouseEvent): void {
    if (this.macroPlaying || !this.macroRecording) return
    if (this.deps.isPointInAppWindow(e.x, e.y)) return
    this.deps.onMacroMove(e.x, e.y)
  }

  private handleHoldDown(token: string): void {
    const engine = this.deps.engine
    // Auto-repeat events while already holding, or activity during another run.
    if (engine.isRunning()) return

    // Hidden sections don't trigger holds (their feature is disabled).
    const profile = applyHiddenSections(this.deps.getProfile())

    if (profile.focusHold.enabled && tokenFor(profile.focusHold.key) === token) {
      this.heldToken = token
      this.heldMode = 'focus-hold'
      engine.start(profile, 'focus-hold')
      return
    }

    if (profile.rightClickHold.enabled && tokenFor(profile.rightClickHold.key) === token) {
      this.heldToken = token
      this.heldMode = 'right-click-hold'
      engine.start(profile, 'right-click-hold')
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

/** Map a configured hold-key/mouse string to the same token format as live events. */
function tokenFor(key: string): string | null {
  if (!key) return null
  const button = mouseButtonNumber(key)
  if (button !== null) return `m:${button}`
  const code = keycodeForName(key)
  return code === null ? null : `k:${code}`
}

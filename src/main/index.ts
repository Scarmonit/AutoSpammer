import { app, BrowserWindow, ipcMain, shell, Notification, screen, nativeImage } from 'electron'
import { join } from 'path'
import type {
  PersistedData,
  Profile,
  AppSettings,
  StatusPayload,
  RecordedKey,
  HotkeyConflict
} from '@shared/types'
import type { ClickPosition, AuxStatus, MacroConfig, MacroEvent } from '@shared/types'
import { IPC } from '@shared/ipc'
import { createDefaultProfile, makeId } from '@shared/defaults'
import { loadData, saveData, flushDataSync, activeProfile } from './persistence'
import { SpamEngine } from './engine'
import { GlobalInput } from './hotkeys'
import { AuxController } from './auxmodes'
import { getMousePosition } from './input'
import { pointInRect } from './geometry'
import { parseAccelerator } from './keymap'
import { MacroRecorder, MacroPlayer } from './macro'
import { createTray, type TrayHandle } from './tray'
import { WINDOW_ICON_DATA_URL } from './trayicon'

let mainWindow: BrowserWindow | null = null
let data: PersistedData
let engine: SpamEngine
let globalInput: GlobalInput
let aux: AuxController
let macroRecorder: MacroRecorder
let macroPlayer: MacroPlayer
let trayHandle: TrayHandle | null = null
let isQuitting = false
let trayHintShown = false

/** Start/stop manual spam (used by the tray menu). */
function toggleSpam(): void {
  if (engine.isRunning()) engine.stop()
  else engine.start(activeProfile(data), 'manual')
}

/** Arm the emergency-stop hotkey whenever anything is active. */
function updateEmergencyArmed(): void {
  const s = aux.getStatus()
  globalInput.setEmergencyArmed(engine.isRunning() || s.holdActive || s.periodicActive)
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 760,
    height: 740,
    minWidth: 680,
    minHeight: 600,
    title: 'Auto Spammer',
    icon: nativeImage.createFromDataURL(WINDOW_ICON_DATA_URL),
    backgroundColor: '#1b1d22',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // The preload only uses contextBridge + ipcRenderer, which work under the
      // OS sandbox — so keep Electron's secure default enabled.
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // Apply the saved UI scale before content paints, so there's no resize flash.
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.setZoomFactor(data.settings.uiScale ?? 1)
  })

  // Close-to-tray: hide the window instead of quitting, so global hotkeys keep
  // working in the background. Real quit goes through the tray / before-quit.
  mainWindow.on('close', (e) => {
    if (isQuitting) return
    e.preventDefault()
    mainWindow?.hide()
    if (!trayHintShown && Notification.isSupported()) {
      trayHintShown = true
      new Notification({
        title: 'Auto Spammer is still running',
        body: 'It lives in the system tray. Right-click the tray icon to quit.'
      }).show()
    }
  })

  // Security hardening (Electron security checklist / Electronegativity):
  // open external links only for safe schemes, and never in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  // This app only renders its own bundled content — block any navigation away.
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault())
  // Deny every permission request (camera, mic, geolocation, …); we use none.
  mainWindow.webContents.session.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function send(channel: string, payload: unknown): void {
  mainWindow?.webContents.send(channel, payload)
}

/** Is the main window the OS-focused window right now? */
function isMainWindowFocused(): boolean {
  return mainWindow?.isFocused() ?? false
}

/**
 * Does a screen point (in physical pixels, as reported by the global mouse hook)
 * fall inside the visible Auto Spammer window? Window bounds are DIP, so convert
 * them to physical pixels first to stay correct under display scaling. Used to
 * drop clicks on our own UI while recording (e.g. the "Stop Recording" button).
 */
function isPointInMainWindow(x: number, y: number): boolean {
  const win = mainWindow
  if (!win || win.isDestroyed() || !win.isVisible() || win.isMinimized()) return false
  const rect = screen.dipToScreenRect(win, win.getBounds())
  return pointInRect(x, y, rect)
}

// ---------------------------------------------------------------------------
// Validation helpers — never trust numeric input coming from the renderer.
// ---------------------------------------------------------------------------
function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function sanitizeProfile(p: Profile): Profile {
  return {
    ...p,
    options: {
      ...p.options,
      defaultDelayMs: clampInt(p.options.defaultDelayMs, 0, 600000, 10),
      // Default missing flags to "on" so older saves spam as before.
      enableKeys: p.options.enableKeys !== false,
      enableClickPositions: p.options.enableClickPositions !== false
    },
    entries: p.entries.map((e) => ({
      ...e,
      delayMs: e.delayMs === null ? null : clampInt(e.delayMs, 0, 600000, 0)
    })),
    textFunction: {
      ...p.textFunction,
      delayMs: clampInt(p.textFunction.delayMs, 0, 600000, 25)
    },
    clickPositions: (p.clickPositions ?? []).map((c) => ({
      ...c,
      x: clampInt(c.x, -100000, 100000, 0),
      y: clampInt(c.y, -100000, 100000, 0),
      button: c.button === 'right' ? 'right' : 'left',
      delayMs: c.delayMs === null ? null : clampInt(c.delayMs, 0, 600000, 0)
    })),
    holdKeys: {
      enabled: p.holdKeys?.enabled !== false,
      keys: (p.holdKeys?.keys ?? []).map((k) => String(k))
    },
    periodicKey: {
      enabled: p.periodicKey?.enabled !== false,
      entries: (p.periodicKey?.entries ?? []).map((e) => ({
        id: typeof e?.id === 'string' ? e.id : makeId('pk'),
        key: String(e?.key ?? ''),
        // seconds, clamped to a sane range (0.1s – 3600s)
        intervalSec: Math.min(3600, Math.max(0.1, Number(e?.intervalSec) || 5))
      }))
    },
    loop: {
      ...p.loop,
      count: clampInt(p.loop.count, 1, 1000000, 1)
    },
    holdToSpam: { ...p.holdToSpam, delayMs: clampInt(p.holdToSpam.delayMs, 1, 600000, 10) },
    focusHold: { ...p.focusHold, delayMs: clampInt(p.focusHold.delayMs, 1, 600000, 10) },
    rightClickHold: {
      ...p.rightClickHold,
      delayMs: clampInt(p.rightClickHold?.delayMs, 1, 600000, 10)
    },
    sectionHeights: sanitizeSectionHeights(p.sectionHeights),
    collapsedSections: sanitizeCollapsedSections(p.collapsedSections),
    macro: sanitizeMacro(p.macro)
  }
}

const MACRO_EVENT_TYPES = new Set<MacroEvent['type']>([
  'key-down',
  'key-up',
  'mouse-down',
  'mouse-up',
  'mouse-move'
])

/** Validate a persisted/edited macro: known event types, clamped delays/coords. */
function sanitizeMacro(raw: unknown): MacroConfig {
  const r = (raw ?? {}) as Partial<MacroConfig>
  const events = Array.isArray(r.events) ? r.events : []
  return {
    enabled: r.enabled === true,
    events: events
      .slice(0, 50000)
      .map(sanitizeMacroEvent)
      .filter((e): e is MacroEvent => e !== null)
  }
}

function sanitizeMacroEvent(raw: unknown): MacroEvent | null {
  const e = (raw ?? {}) as Partial<MacroEvent>
  if (!e.type || !MACRO_EVENT_TYPES.has(e.type)) return null
  const ev: MacroEvent = {
    id: typeof e.id === 'string' ? e.id : makeId('mev'),
    type: e.type,
    delayMs: clampInt(e.delayMs, 0, 600000, 0)
  }
  if (e.type === 'key-down' || e.type === 'key-up') {
    ev.key = String(e.key ?? '')
  } else {
    ev.x = clampInt(e.x, -100000, 100000, 0)
    ev.y = clampInt(e.y, -100000, 100000, 0)
    if (e.type !== 'mouse-move') {
      ev.button = e.button === 'right' ? 'right' : e.button === 'middle' ? 'middle' : 'left'
    }
  }
  return ev
}

/** Keep only finite, sanely-clamped pixel heights keyed by a section id. */
function sanitizeSectionHeights(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(value)
    if (Number.isFinite(n)) out[String(id)] = clampInt(n, 64, 2000, 64)
  }
  return out
}

/** Keep only the truly-collapsed section ids (drops anything not === true). */
function sanitizeCollapsedSections(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, boolean> = {}
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === true) out[String(id)] = true
  }
  return out
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
function registerIpc(): void {
  ipcMain.handle(IPC.GetData, () => data)

  ipcMain.handle(IPC.SaveProfile, (_e, profile: Profile) => {
    const clean = sanitizeProfile(profile)
    const idx = data.profiles.findIndex((p) => p.id === clean.id)
    if (idx >= 0) data.profiles[idx] = clean
    saveData(data)
    globalInput.onSettingsChanged() // hold-key changes live in the profile
    return data
  })

  ipcMain.handle(IPC.CreateProfile, (_e, name: string) => {
    const profile = createDefaultProfile(name?.trim() || `Profile ${data.profiles.length + 1}`)
    profile.id = makeId('profile')
    data.profiles.push(profile)
    data.settings.activeProfileId = profile.id
    saveData(data)
    return data
  })

  ipcMain.handle(IPC.RenameProfile, (_e, args: { id: string; name: string }) => {
    const p = data.profiles.find((x) => x.id === args.id)
    if (p) p.name = args.name?.trim() || p.name
    saveData(data)
    return data
  })

  ipcMain.handle(IPC.DeleteProfile, (_e, id: string) => {
    if (data.profiles.length <= 1) return data // always keep one
    data.profiles = data.profiles.filter((p) => p.id !== id)
    if (data.settings.activeProfileId === id) {
      data.settings.activeProfileId = data.profiles[0].id
    }
    saveData(data)
    return data
  })

  ipcMain.handle(IPC.SetActiveProfile, (_e, id: string) => {
    if (data.profiles.some((p) => p.id === id)) {
      data.settings.activeProfileId = id
      saveData(data)
    }
    return data
  })

  ipcMain.handle(IPC.UpdateSettings, (_e, patch: Partial<AppSettings>) => {
    data.settings = { ...data.settings, ...patch }
    // Clamp the UI scale to a sane zoom range.
    data.settings.uiScale = Math.min(2.5, Math.max(1, Number(data.settings.uiScale) || 1))
    saveData(data)
    globalInput.onSettingsChanged()
    return data
  })

  ipcMain.handle(IPC.Start, () => {
    // A one-shot macro preview from the panel owns playback while it runs.
    if (!macroPlayer.isPlaying()) engine.start(activeProfile(data), 'manual')
    return engine.getStatus()
  })

  ipcMain.handle(IPC.Stop, () => {
    engine.stop()
    return engine.getStatus()
  })

  ipcMain.handle(IPC.GetStatus, () => engine.getStatus())

  ipcMain.handle(IPC.RecordStart, () => {
    globalInput.setRecording(true)
  })

  ipcMain.handle(IPC.RecordStop, () => {
    globalInput.setRecording(false)
  })

  ipcMain.handle(IPC.RecordPositionsStart, () => {
    globalInput.setRecordingPositions(true)
  })

  ipcMain.handle(IPC.RecordPositionsStop, () => {
    globalInput.setRecordingPositions(false)
  })

  ipcMain.handle(IPC.GetMousePosition, () => getMousePosition())

  ipcMain.handle(IPC.ToggleHold, () => {
    aux.toggleHold()
    return aux.getStatus()
  })

  ipcMain.handle(IPC.TogglePeriodic, () => {
    aux.togglePeriodic()
    return aux.getStatus()
  })

  ipcMain.handle(IPC.GetAuxStatus, () => aux.getStatus())

  ipcMain.handle(IPC.MacroRecordStart, () => startMacroRecording())
  ipcMain.handle(IPC.MacroRecordStop, () => stopMacroRecording())

  ipcMain.handle(IPC.MacroPlay, (_e, events: MacroEvent[]) => {
    // The panel's one-shot preview yields to the main spam engine and recording.
    if (macroPlayer.isPlaying() || macroRecorder.isRecording() || engine.isRunning()) return
    void macroPlayer.play(Array.isArray(events) ? events : [])
  })

  ipcMain.handle(IPC.MacroStopPlay, () => macroPlayer.stop())
}

/**
 * Append a click position to the active profile and push the new data back to
 * the renderer. Shared by the global record-position hotkey, the live
 * click-recording mode, and any other in-main mutation, so they never drift.
 */
function appendClickPosition(x: number, y: number, button: 'left' | 'right'): void {
  const profile = activeProfile(data)
  const pos: ClickPosition = {
    id: makeId('pos'),
    x: Math.round(x),
    y: Math.round(y),
    button,
    delayMs: null
  }
  profile.clickPositions = [...(profile.clickPositions ?? []), pos]
  saveData(data)
  send(IPC.DataUpdated, data)
}

/**
 * Capture the cursor's current position and append it to the active profile's
 * click list. Triggered by the global record-position hotkey (works in-game),
 * so it owns the data mutation and pushes the result back to the renderer.
 */
async function recordCurrentPosition(): Promise<void> {
  const { x, y } = await getMousePosition()
  appendClickPosition(x, y, 'left')
}

// ---------------------------------------------------------------------------
// Macro recording / playback
// ---------------------------------------------------------------------------
function startMacroRecording(): void {
  if (macroRecorder.isRecording()) return
  macroRecorder.start()
  globalInput.setMacroRecording(true)
  send(IPC.MacroRecording, true)
}

function stopMacroRecording(): void {
  if (!macroRecorder.isRecording()) return
  // The hotkey that stopped us (and its modifiers) must not pollute the macro.
  const combo = parseAccelerator(data.settings.macroRecordHotkey)
  const events = macroRecorder.stop(
    combo ? { ctrl: combo.ctrl, alt: combo.alt, shift: combo.shift, meta: combo.meta } : undefined
  )
  globalInput.setMacroRecording(false)
  const profile = activeProfile(data)
  profile.macro = { ...profile.macro, events }
  saveData(data)
  send(IPC.MacroRecording, false)
  send(IPC.DataUpdated, data) // push the freshly recorded events to the renderer
}

function toggleMacroRecording(): void {
  if (macroRecorder.isRecording()) stopMacroRecording()
  else startMacroRecording()
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    data = await loadData()

    engine = new SpamEngine({
      onStatus: (s: StatusPayload) => {
        send(IPC.StatusChanged, s)
        updateEmergencyArmed()
        trayHandle?.update()
      },
      onError: (message: string) => send(IPC.ErrorEvent, message)
    })

    aux = new AuxController({
      getProfile: () => activeProfile(data),
      onStatus: (s: AuxStatus) => {
        send(IPC.AuxStatusChanged, s)
        updateEmergencyArmed()
        trayHandle?.update()
      },
      onError: (message: string) => send(IPC.ErrorEvent, message)
    })

    globalInput = new GlobalInput({
      getProfile: () => activeProfile(data),
      getSettings: () => data.settings,
      engine,
      onRecorded: (rk: RecordedKey) => send(IPC.KeyRecorded, rk),
      onConflict: (c: HotkeyConflict) => send(IPC.HotkeyConflict, c),
      onRecordPosition: () => {
        void recordCurrentPosition()
      },
      onRecordPositionAt: (x, y, button) => appendClickPosition(x, y, button),
      onToggleHold: () => aux.toggleHold(),
      onTogglePeriodic: () => aux.togglePeriodic(),
      onEmergencyStop: () => {
        engine.stop()
        aux.stopAll()
      },
      isAppFocused: () => isMainWindowFocused(),
      isPointInAppWindow: (x, y) => isPointInMainWindow(x, y),
      onMacroToggleHotkey: () => toggleMacroRecording(),
      onMacroKey: (type, name) =>
        type === 'down' ? macroRecorder.keyDown(name) : macroRecorder.keyUp(name),
      onMacroMouse: (type, button, x, y) =>
        type === 'down' ? macroRecorder.mouseDown(button, x, y) : macroRecorder.mouseUp(button, x, y),
      onMacroMove: (x, y) => macroRecorder.mouseMove(x, y)
    })

    macroRecorder = new MacroRecorder()
    macroPlayer = new MacroPlayer({
      onStart: () => {
        globalInput.setMacroPlaying(true)
        send(IPC.MacroPlaying, true)
      },
      onStop: () => {
        globalInput.setMacroPlaying(false)
        send(IPC.MacroPlaying, false)
      },
      onError: (message: string) => send(IPC.ErrorEvent, message)
    })

    registerIpc()
    createWindow()
    globalInput.start()

    trayHandle = createTray({
      getWindow: () => mainWindow,
      isSpamming: () => engine.isRunning() || aux.getStatus().holdActive || aux.getStatus().periodicActive,
      onToggleSpam: toggleSpam,
      onPanic: () => {
        engine.stop()
        aux.stopAll()
      },
      onQuit: () => {
        isQuitting = true
        app.quit()
      }
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  // Any quit path (tray, OS, app.quit) marks us as quitting so the window's
  // close-to-tray handler lets it actually close.
  app.on('before-quit', () => {
    isQuitting = true
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  let cleanedUp = false
  app.on('will-quit', () => {
    if (cleanedUp) return
    cleanedUp = true
    // Synchronous, best-effort cleanup so the app exits promptly (no
    // preventDefault, which can stall graceful shutdown / automated close).
    try {
      engine?.stop()
    } catch {
      /* ignore */
    }
    try {
      aux?.stopAll() // release any held keys / stop the periodic timer
    } catch {
      /* ignore */
    }
    try {
      macroPlayer?.stop() // cancel any in-flight macro playback
    } catch {
      /* ignore */
    }
    try {
      globalInput?.dispose()
    } catch {
      /* ignore */
    }
    try {
      trayHandle?.tray.destroy()
    } catch {
      /* ignore */
    }
    flushDataSync()
  })
}

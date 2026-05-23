import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import type {
  PersistedData,
  Profile,
  AppSettings,
  StatusPayload,
  RecordedKey,
  HotkeyConflict
} from '@shared/types'
import type { ClickPosition, AuxStatus } from '@shared/types'
import { IPC } from '@shared/ipc'
import { createDefaultProfile, makeId } from '@shared/defaults'
import { loadData, saveData, flushData, activeProfile } from './persistence'
import { SpamEngine } from './engine'
import { GlobalInput } from './hotkeys'
import { AuxController } from './auxmodes'
import { getMousePosition } from './input'

let mainWindow: BrowserWindow | null = null
let data: PersistedData
let engine: SpamEngine
let globalInput: GlobalInput
let aux: AuxController

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
    backgroundColor: '#1b1d22',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function send(channel: string, payload: unknown): void {
  mainWindow?.webContents.send(channel, payload)
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
      defaultDelayMs: clampInt(p.options.defaultDelayMs, 0, 600000, 10)
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
      keys: (p.holdKeys?.keys ?? []).map((k) => String(k))
    },
    periodicKey: {
      key: String(p.periodicKey?.key ?? ''),
      // seconds, clamped to a sane range (0.1s – 3600s)
      intervalSec: Math.min(3600, Math.max(0.1, Number(p.periodicKey?.intervalSec) || 5))
    },
    loop: {
      ...p.loop,
      count: clampInt(p.loop.count, 1, 1000000, 1)
    },
    holdToSpam: { ...p.holdToSpam, delayMs: clampInt(p.holdToSpam.delayMs, 1, 600000, 10) },
    focusHold: { ...p.focusHold, delayMs: clampInt(p.focusHold.delayMs, 1, 600000, 10) }
  }
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
    saveData(data)
    globalInput.onSettingsChanged()
    return data
  })

  ipcMain.handle(IPC.Start, () => {
    engine.start(activeProfile(data), 'manual')
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
}

/**
 * Capture the cursor's current position and append it to the active profile's
 * click list. Triggered by the global record-position hotkey (works in-game),
 * so it owns the data mutation and pushes the result back to the renderer.
 */
async function recordCurrentPosition(): Promise<void> {
  const profile = activeProfile(data)
  const { x, y } = await getMousePosition()
  const pos: ClickPosition = { id: makeId('pos'), x, y, button: 'left', delayMs: null }
  profile.clickPositions = [...(profile.clickPositions ?? []), pos]
  saveData(data)
  send(IPC.DataUpdated, data)
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
      },
      onError: (message: string) => send(IPC.ErrorEvent, message)
    })

    aux = new AuxController({
      getProfile: () => activeProfile(data),
      onStatus: (s: AuxStatus) => {
        send(IPC.AuxStatusChanged, s)
        updateEmergencyArmed()
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
      onToggleHold: () => aux.toggleHold(),
      onTogglePeriodic: () => aux.togglePeriodic(),
      onEmergencyStop: () => {
        engine.stop()
        aux.stopAll()
      }
    })

    registerIpc()
    createWindow()
    globalInput.start()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('will-quit', async (e) => {
    e.preventDefault()
    engine?.stop()
    aux?.stopAll() // release any held keys / stop the periodic timer
    globalInput?.dispose()
    await flushData()
    app.exit(0)
  })
}

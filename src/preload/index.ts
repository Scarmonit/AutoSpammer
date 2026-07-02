import { contextBridge, ipcRenderer, webFrame } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  PersistedData,
  Profile,
  AppSettings,
  StatusPayload,
  RecordedKey,
  HotkeyConflict,
  MousePoint,
  MacroEvent
} from '@shared/types'

/** Subscribe helper that returns an unsubscribe function. */
function on<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: unknown, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener as never)
  return () => ipcRenderer.removeListener(channel, listener as never)
}

const api = {
  getData: (): Promise<PersistedData> => ipcRenderer.invoke(IPC.GetData),
  saveProfile: (profile: Profile): Promise<PersistedData> =>
    ipcRenderer.invoke(IPC.SaveProfile, profile),
  createProfile: (name: string): Promise<PersistedData> =>
    ipcRenderer.invoke(IPC.CreateProfile, name),
  renameProfile: (id: string, name: string): Promise<PersistedData> =>
    ipcRenderer.invoke(IPC.RenameProfile, { id, name }),
  deleteProfile: (id: string): Promise<PersistedData> => ipcRenderer.invoke(IPC.DeleteProfile, id),
  setActiveProfile: (id: string): Promise<PersistedData> =>
    ipcRenderer.invoke(IPC.SetActiveProfile, id),
  updateSettings: (patch: Partial<AppSettings>): Promise<PersistedData> =>
    ipcRenderer.invoke(IPC.UpdateSettings, patch),

  start: (): Promise<StatusPayload> => ipcRenderer.invoke(IPC.Start),
  stop: (): Promise<StatusPayload> => ipcRenderer.invoke(IPC.Stop),
  getStatus: (): Promise<StatusPayload> => ipcRenderer.invoke(IPC.GetStatus),

  recordStart: (): Promise<void> => ipcRenderer.invoke(IPC.RecordStart),
  recordStop: (): Promise<void> => ipcRenderer.invoke(IPC.RecordStop),
  recordPositionsStart: (): Promise<void> => ipcRenderer.invoke(IPC.RecordPositionsStart),
  recordPositionsStop: (): Promise<void> => ipcRenderer.invoke(IPC.RecordPositionsStop),
  getMousePosition: (): Promise<MousePoint> => ipcRenderer.invoke(IPC.GetMousePosition),
  /** The key-capture overlay is open: suspend all global hotkeys/triggers. */
  captureStart: (): Promise<void> => ipcRenderer.invoke(IPC.CaptureStart),
  /** The overlay closed: re-register the global hotkeys. */
  captureStop: (): Promise<void> => ipcRenderer.invoke(IPC.CaptureStop),

  /** Scale the whole renderer (text, padding, buttons) like browser zoom. */
  setZoomFactor: (factor: number): void => webFrame.setZoomFactor(factor),

  macroRecordStart: (): Promise<void> => ipcRenderer.invoke(IPC.MacroRecordStart),
  macroRecordStop: (): Promise<void> => ipcRenderer.invoke(IPC.MacroRecordStop),
  macroPlay: (events: MacroEvent[]): Promise<void> => ipcRenderer.invoke(IPC.MacroPlay, events),
  macroStopPlay: (): Promise<void> => ipcRenderer.invoke(IPC.MacroStopPlay),

  onStatus: (cb: (s: StatusPayload) => void) => on<StatusPayload>(IPC.StatusChanged, cb),
  onKeyRecorded: (cb: (rk: RecordedKey) => void) => on<RecordedKey>(IPC.KeyRecorded, cb),
  onError: (cb: (message: string) => void) => on<string>(IPC.ErrorEvent, cb),
  onHotkeyConflict: (cb: (c: HotkeyConflict) => void) => on<HotkeyConflict>(IPC.HotkeyConflict, cb),
  onDataUpdated: (cb: (data: PersistedData) => void) => on<PersistedData>(IPC.DataUpdated, cb),
  onMacroRecording: (cb: (recording: boolean) => void) => on<boolean>(IPC.MacroRecording, cb),
  onMacroPlaying: (cb: (playing: boolean) => void) => on<boolean>(IPC.MacroPlaying, cb)
}

export type AutoSpammerApi = typeof api

contextBridge.exposeInMainWorld('api', api)

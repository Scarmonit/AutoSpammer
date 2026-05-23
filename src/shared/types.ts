// Types shared between the main process, preload bridge, and renderer.

/** What a single spam action does. */
export type ActionKind = 'key' | 'mouse-left' | 'mouse-right'

/** One entry in the "Keys to Spam" list. */
export interface SpamEntry {
  id: string
  kind: ActionKind
  /** Logical key name (e.g. "a", "space", "f1", "enter"). Ignored for mouse kinds. */
  key: string
  /** Per-entry delay in ms. `null` means "use the global default delay". */
  delayMs: number | null
}

export interface TextFunctionConfig {
  enabled: boolean
  text: string
  delayMs: number
}

export type LoopMode = 'forever' | 'once' | 'count'

export interface LoopConfig {
  mode: LoopMode
  /** Number of cycles when mode === 'count'. */
  count: number
}

/** Shared shape for the two "hold to spam" features. */
export interface HoldConfig {
  enabled: boolean
  /** Physical key/button name to watch (e.g. "v", "mouse-left"). Empty = unset. */
  key: string
  delayMs: number
}

export interface Options {
  spacebar: boolean
  leftClick: boolean
  rightClick: boolean
  defaultDelayMs: number
  sequenceMode: boolean
}

export interface Profile {
  id: string
  name: string
  entries: SpamEntry[]
  options: Options
  textFunction: TextFunctionConfig
  loop: LoopConfig
  holdToSpam: HoldConfig
  focusHold: HoldConfig
}

export interface AppSettings {
  /** Electron accelerator string, e.g. "F6", "CommandOrControl+Shift+S". */
  toggleHotkey: string
  /** Emergency stop accelerator, e.g. "Escape". */
  emergencyHotkey: string
  activeProfileId: string
}

export interface PersistedData {
  version: number
  settings: AppSettings
  profiles: Profile[]
}

export type EngineStatus = 'idle' | 'running'
export type SpamMode = 'manual' | 'hold' | 'focus-hold'

export interface StatusPayload {
  status: EngineStatus
  mode: SpamMode | null
  cyclesDone: number
}

export interface RecordedKey {
  kind: ActionKind
  key: string
}

export interface HotkeyConflict {
  field: 'toggleHotkey' | 'emergencyHotkey'
  accelerator: string
  message: string
}

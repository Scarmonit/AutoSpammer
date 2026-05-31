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

/** A recorded screen location to click during spamming. */
export interface ClickPosition {
  id: string
  x: number
  y: number
  button: 'left' | 'right'
  /** Per-position delay in ms. `null` means "use the global default delay". */
  delayMs: number | null
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
  /** Master switch: include the "Keys to Spam" list (plus the spacebar/click options). */
  enableKeys: boolean
  /** Master switch: include the recorded Click Positions. */
  enableClickPositions: boolean
}

/** Keys to physically hold DOWN continuously (not tapped) while active. */
export interface HoldKeysConfig {
  keys: string[]
}

/** A single chosen key pressed once every N seconds while active. */
export interface PeriodicKeyConfig {
  key: string
  intervalSec: number
}

export interface Profile {
  id: string
  name: string
  entries: SpamEntry[]
  options: Options
  textFunction: TextFunctionConfig
  clickPositions: ClickPosition[]
  holdKeys: HoldKeysConfig
  periodicKey: PeriodicKeyConfig
  loop: LoopConfig
  holdToSpam: HoldConfig
  focusHold: HoldConfig
  /** Hold a chosen key/button to auto right-click while it's held down. */
  rightClickHold: HoldConfig
  /**
   * Per-section pixel heights for the resizable layout, keyed by section id
   * (e.g. "keys", "clickPositions"). A missing id means "use the natural height".
   */
  sectionHeights: Record<string, number>
  /**
   * Sections the user has collapsed (header-only), keyed by section id.
   * `true` = collapsed; a missing id means the section is expanded.
   */
  collapsedSections: Record<string, boolean>
}

export interface AppSettings {
  /** Electron accelerator string, e.g. "F6", "CommandOrControl+Shift+S". */
  toggleHotkey: string
  /** Emergency stop accelerator, e.g. "Escape". */
  emergencyHotkey: string
  /** Global hotkey to record the current mouse position, e.g. "F7". */
  recordPositionHotkey: string
  /** Global hotkey to toggle the hold-keys-down mode, e.g. "F8". */
  holdKeysHotkey: string
  /** Global hotkey to toggle the periodic key press, e.g. "F9". */
  periodicKeyHotkey: string
  activeProfileId: string
}

export interface PersistedData {
  version: number
  settings: AppSettings
  profiles: Profile[]
}

export type EngineStatus = 'idle' | 'running'
export type SpamMode = 'manual' | 'hold' | 'focus-hold' | 'right-click-hold'

export interface StatusPayload {
  status: EngineStatus
  mode: SpamMode | null
  cyclesDone: number
}

export interface RecordedKey {
  kind: ActionKind
  key: string
}

export type HotkeyField =
  | 'toggleHotkey'
  | 'emergencyHotkey'
  | 'recordPositionHotkey'
  | 'holdKeysHotkey'
  | 'periodicKeyHotkey'

export interface HotkeyConflict {
  field: HotkeyField
  accelerator: string
  message: string
}

export interface MousePoint {
  x: number
  y: number
}

/** Runtime on/off state of the auxiliary modes (not persisted). */
export interface AuxStatus {
  holdActive: boolean
  periodicActive: boolean
}

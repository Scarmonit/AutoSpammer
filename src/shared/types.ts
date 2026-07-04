// Types shared between the main process, preload bridge, and renderer.

import type { SectionLayout } from './sections'

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
  /** When on, Start Spam (and F6) also holds these keys down for the run. */
  enabled: boolean
  keys: string[]
}

/** One key/mouse-button pressed once every N seconds while active. */
export interface PeriodicEntry {
  id: string
  /** Logical key name or mouse button (e.g. "f", "mouse-left"). */
  key: string
  intervalSec: number
}

/** Any number of periodic presses, each on its own independent timer. */
export interface PeriodicKeyConfig {
  /** When on, Start Spam (and F6) also runs the periodic presses for the run. */
  enabled: boolean
  entries: PeriodicEntry[]
}

/** One recorded input event in a macro. */
export type MacroEventType = 'key-down' | 'key-up' | 'mouse-down' | 'mouse-up' | 'mouse-move'

export interface MacroEvent {
  id: string
  type: MacroEventType
  /** Milliseconds to wait BEFORE firing this event (relative to the previous one). Editable. */
  delayMs: number
  /** Logical key name for key events (e.g. "a", "shift", "f5"). */
  key?: string
  /** Mouse button for mouse-down / mouse-up events. */
  button?: 'left' | 'right' | 'middle'
  /** Absolute screen coordinates for mouse events. */
  x?: number
  y?: number
}

/** A full keyboard + mouse recording that can be replayed. */
export interface MacroConfig {
  /** When on, Keys to Spam and Click Positions are forced off (mutually exclusive). */
  enabled: boolean
  events: MacroEvent[]
}

// ---------------------------------------------------------------------------
// Detection triggers: watch a screen pixel/region and fire an action when a
// color or a captured image appears there.
// ---------------------------------------------------------------------------

export type DetectionMode = 'color' | 'image'

/** A screen rectangle in physical pixels (same space as Click Positions). */
export interface DetectionRect {
  x: number
  y: number
  width: number
  height: number
}

/** What a detection trigger does when its condition matches. */
export interface DetectionAction {
  kind: 'key' | 'mouse-left' | 'mouse-right' | 'position'
  /** Logical key name when kind === 'key' (e.g. "f", "space"). */
  key: string
  /** Saved Click Position id when kind === 'position'. */
  positionId: string
}

export interface DetectionTrigger {
  id: string
  enabled: boolean
  mode: DetectionMode
  /** Watched pixel (color mode). */
  x: number
  y: number
  /** Expected pixel color as '#rrggbb' (color mode). */
  color: string
  /** Max per-RGB-channel difference that still matches (0 = exact). */
  tolerance: number
  /** Captured template as a PNG data URL (image mode). Null = not captured yet. */
  image: string | null
  /** Where to look for the template; null = the whole primary display. */
  searchArea: DetectionRect | null
  action: DetectionAction
}

export interface DetectionConfig {
  /** Section master switch: run the triggers during a spam run. */
  enabled: boolean
  /** How often the screen is checked while running, in ms. */
  pollMs: number
  triggers: DetectionTrigger[]
}

/** Live per-trigger snapshot for the card's "now:" readout. */
export interface DetectionProbeResult {
  id: string
  /** Does the trigger's condition match the screen right now? */
  matched: boolean
  /** Current color under the watched pixel ('#rrggbb'), color mode only. */
  currentColor: string | null
  /** Why the trigger can't run (setup gap or capture failure), or null. */
  issue: string | null
}

/** Result of the one-shot "Pick pixel" flow (physical pixels + '#rrggbb'). */
export interface PixelPickedPayload {
  x: number
  y: number
  color: string
}

/** Result of the two-click "Capture region" flow. */
export interface RegionCapturedPayload {
  purpose: 'template' | 'search'
  rect: DetectionRect
  /** PNG data URL of the captured region (only for purpose === 'template'). */
  image: string | null
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
  /**
   * Sections hidden via the Sections manager, keyed by section id. `true` =
   * hidden (removed from the UI and skipped on a run); a missing id means the
   * section is visible. All sections are visible by default.
   */
  hiddenSections: Record<string, boolean>
  /**
   * Master enable for whole "container" sections (Keys to Spam, Hold Actions),
   * keyed by section id. `true` = the section is disabled (its features are
   * skipped on a run and its body is dimmed); a missing id means enabled. The
   * individual feature toggles inside still work when the section is enabled.
   */
  disabledSections: Record<string, boolean>
  /** Full keyboard + mouse macro recording for this profile. */
  macro: MacroConfig
  /** Pixel-color / image detection triggers polled during a run. */
  detection: DetectionConfig
  /** Drag-and-drop section order, per column. */
  sectionLayout: SectionLayout
}

/** Last saved main-window geometry, restored on the next launch. */
export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface AppSettings {
  /** Electron accelerator string, e.g. "F6", "CommandOrControl+Shift+S". */
  toggleHotkey: string
  /** Emergency stop accelerator, e.g. "Escape". */
  emergencyHotkey: string
  /** Global hotkey to record the current mouse position, e.g. "F7". */
  recordPositionHotkey: string
  /** Global hotkey to start/stop macro recording, e.g. "F10". */
  macroRecordHotkey: string
  /** Whole-window UI scale (zoom factor), e.g. 1 = 100%, 1.5 = 150%. */
  uiScale: number
  /** Show the friendly one-line descriptions / hint text under section titles. */
  showHints: boolean
  /** Show the "WHEN RUNNING" plain-English summary bar under the profile row. */
  showSummaryBar: boolean
  /**
   * When true (default), closing the window (X) hides it to the system tray and
   * keeps global hotkeys running. When false, closing fully quits the app.
   */
  minimizeToTrayOnClose: boolean
  /** Last main-window size + position; restored on launch. Null = use defaults. */
  windowBounds: WindowBounds | null
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

export interface HotkeyConflict {
  field: HotkeyField
  accelerator: string
  message: string
}

export interface MousePoint {
  x: number
  y: number
}

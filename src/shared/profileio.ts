// Profile sanitising + share-file helpers. Pure and dependency-free (no
// Electron imports) so the same code validates profiles loaded from the
// normal save file (persistence.ts) AND from exported .monit files — an
// exported profile is exactly the persisted structure, wrapped in a small
// typed envelope.

import type {
  Profile,
  SpamEntry,
  PeriodicEntry,
  HoldConfig,
  ClickPosition,
  DetectionTrigger,
  DetectionRect
} from './types'
import { createDefaultProfile, createDefaultDetectionTrigger, makeId, DATA_VERSION } from './defaults'
import { normalizeLayout } from './sections'

/** Marker so a random JSON file can't be mistaken for a profile export. */
export const PROFILE_FILE_TYPE = 'monit-profile'

/** File extension for shared profiles (plain JSON inside). */
export const PROFILE_FILE_EXT = 'monit'

const ENTRY_KINDS = new Set(['key', 'mouse-left', 'mouse-right'])
const LOOP_MODES = new Set(['forever', 'once', 'count'])
const DETECTION_ACTION_KINDS = new Set(['key', 'mouse-left', 'mouse-right', 'position'])

/** Poll-interval bounds for the detection watcher (ms). */
export const DETECTION_POLL_MIN_MS = 50
export const DETECTION_POLL_MAX_MS = 10000
export const DETECTION_POLL_DEFAULT_MS = 250

/** Template PNGs bigger than this (as a data URL) are dropped on load. */
const MAX_TEMPLATE_DATAURL_LENGTH = 3_000_000

/** '#rrggbb' (lowercase or uppercase), or '' when unset. */
function fixHexColor(v: unknown): string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : ''
}

function fixDetectionRect(v: unknown): DetectionRect | null {
  if (!v || typeof v !== 'object') return null
  const r = v as Partial<DetectionRect>
  if (![r.x, r.y, r.width, r.height].every((n) => Number.isFinite(n))) return null
  const clampCoord = (n: number): number => Math.min(100000, Math.max(-100000, Math.round(n)))
  const width = Math.min(100000, Math.max(1, Math.round(r.width as number)))
  const height = Math.min(100000, Math.max(1, Math.round(r.height as number)))
  return { x: clampCoord(r.x as number), y: clampCoord(r.y as number), width, height }
}

/** Coerce one persisted detection trigger into the current valid shape. */
export function fixDetectionTrigger(v: unknown): DetectionTrigger {
  const def = createDefaultDetectionTrigger()
  if (!v || typeof v !== 'object') return def
  const t = v as Partial<DetectionTrigger>
  const action = (t.action ?? {}) as Partial<DetectionTrigger['action']>
  const image =
    typeof t.image === 'string' &&
    t.image.startsWith('data:image/') &&
    t.image.length <= MAX_TEMPLATE_DATAURL_LENGTH
      ? t.image
      : null
  return {
    id: typeof t.id === 'string' && t.id !== '' ? t.id : def.id,
    enabled: t.enabled !== false,
    mode: t.mode === 'image' ? 'image' : 'color',
    x: Number.isFinite(t.x) ? Math.round(t.x as number) : 0,
    y: Number.isFinite(t.y) ? Math.round(t.y as number) : 0,
    color: fixHexColor(t.color),
    tolerance: Number.isFinite(t.tolerance)
      ? Math.min(255, Math.max(0, Math.round(t.tolerance as number)))
      : def.tolerance,
    image,
    searchArea: fixDetectionRect(t.searchArea),
    action: {
      kind: DETECTION_ACTION_KINDS.has(action.kind as string) ? action.kind! : 'key',
      key: typeof action.key === 'string' ? action.key : '',
      positionId: typeof action.positionId === 'string' ? action.positionId : ''
    }
  }
}

/** The on-disk shape of an exported profile file. */
export interface ProfileExport {
  type: typeof PROFILE_FILE_TYPE
  version: number
  profile: Profile
}

export function exportPayload(profile: Profile): ProfileExport {
  return { type: PROFILE_FILE_TYPE, version: DATA_VERSION, profile }
}

function asBoolMap(v: unknown): Record<string, boolean> {
  return v && typeof v === 'object' ? (v as Record<string, boolean>) : {}
}

function fixHold(cfg: unknown, def: HoldConfig): HoldConfig {
  if (!cfg || typeof cfg !== 'object') return { ...def }
  const c = cfg as Partial<HoldConfig>
  return {
    enabled: c.enabled === true,
    key: typeof c.key === 'string' ? c.key : '',
    delayMs: Number(c.delayMs) >= 1 ? Number(c.delayMs) : def.delayMs
  }
}

/**
 * Coerce a (possibly old, partial, or foreign) profile into the current valid
 * shape, in place. Every field the engine or UI reads is guaranteed present
 * and well-typed afterwards; unknown extra fields are left alone. Shared by
 * the save-file migration and the .monit import path.
 */
export function sanitizeProfile(p: Profile, defaultProfile: Profile): void {
  if (typeof p.id !== 'string' || p.id === '') p.id = makeId('profile')
  p.name = typeof p.name === 'string' && p.name.trim() !== '' ? p.name.trim() : 'Profile'

  // Tap keys list.
  if (!Array.isArray(p.entries)) p.entries = []
  p.entries = p.entries
    .filter((e): e is SpamEntry => !!e && typeof e === 'object')
    .map((e) => ({
      id: typeof e.id === 'string' && e.id !== '' ? e.id : makeId('key'),
      kind: ENTRY_KINDS.has(e.kind as string) ? e.kind : 'key',
      key: typeof e.key === 'string' ? e.key : '',
      delayMs: typeof e.delayMs === 'number' && e.delayMs >= 0 ? e.delayMs : null
    }))

  // Click positions: keep only rows with real coordinates.
  if (!Array.isArray(p.clickPositions)) p.clickPositions = []
  p.clickPositions = p.clickPositions
    .filter(
      (c): c is ClickPosition =>
        !!c && typeof c === 'object' && Number.isFinite(c.x) && Number.isFinite(c.y)
    )
    .map((c) => ({
      id: typeof c.id === 'string' && c.id !== '' ? c.id : makeId('pos'),
      x: Math.round(c.x),
      y: Math.round(c.y),
      button: c.button === 'right' ? 'right' : 'left',
      delayMs: typeof c.delayMs === 'number' && c.delayMs >= 0 ? c.delayMs : null
    }))

  // Hold keys down.
  if (!p.holdKeys || !Array.isArray(p.holdKeys.keys)) p.holdKeys = { enabled: true, keys: [] }
  p.holdKeys.keys = p.holdKeys.keys.filter((k): k is string => typeof k === 'string')
  if (typeof p.holdKeys.enabled !== 'boolean') p.holdKeys.enabled = true

  // Timed key presses.
  if (!p.periodicKey || typeof p.periodicKey !== 'object') {
    p.periodicKey = { ...defaultProfile.periodicKey, entries: [] }
  }
  if (typeof p.periodicKey.enabled !== 'boolean') p.periodicKey.enabled = true
  // Periodic Key became multi-key; migrate the old single { key, intervalSec }.
  if (!Array.isArray(p.periodicKey.entries)) {
    const old = p.periodicKey as unknown as { key?: unknown; intervalSec?: unknown }
    const key = typeof old.key === 'string' ? old.key.trim() : ''
    const intervalSec = Number(old.intervalSec) > 0 ? Number(old.intervalSec) : 5
    p.periodicKey.entries = key ? [{ id: makeId('pk'), key, intervalSec }] : []
    delete (p.periodicKey as { key?: unknown }).key
    delete (p.periodicKey as { intervalSec?: unknown }).intervalSec
  }
  p.periodicKey.entries = p.periodicKey.entries
    .filter((e): e is PeriodicEntry => !!e && typeof e === 'object')
    .map((e) => ({
      id: typeof e.id === 'string' && e.id !== '' ? e.id : makeId('pk'),
      key: typeof e.key === 'string' ? e.key : '',
      intervalSec: Number(e.intervalSec) > 0 ? Number(e.intervalSec) : 5
    }))

  // Text function.
  if (!p.textFunction || typeof p.textFunction !== 'object') {
    p.textFunction = { ...defaultProfile.textFunction }
  } else {
    p.textFunction.enabled = p.textFunction.enabled === true
    if (typeof p.textFunction.text !== 'string') p.textFunction.text = ''
    if (!(typeof p.textFunction.delayMs === 'number' && p.textFunction.delayMs >= 0)) {
      p.textFunction.delayMs = defaultProfile.textFunction.delayMs
    }
  }

  // Loop.
  if (!p.loop || typeof p.loop !== 'object' || !LOOP_MODES.has(p.loop.mode)) {
    p.loop = { ...defaultProfile.loop }
  }
  p.loop.count = Number.isFinite(p.loop.count) && p.loop.count >= 1 ? Math.floor(p.loop.count) : 10

  // Hold triggers.
  p.holdToSpam = fixHold(p.holdToSpam, defaultProfile.holdToSpam)
  p.focusHold = fixHold(p.focusHold, defaultProfile.focusHold)
  p.rightClickHold = fixHold(p.rightClickHold, defaultProfile.rightClickHold)

  // Options: the section masters default to ON for older saves; the extras off.
  if (!p.options || typeof p.options !== 'object') p.options = { ...defaultProfile.options }
  if (typeof p.options.enableKeys !== 'boolean') p.options.enableKeys = true
  if (typeof p.options.enableClickPositions !== 'boolean') p.options.enableClickPositions = true
  if (typeof p.options.spacebar !== 'boolean') p.options.spacebar = false
  if (typeof p.options.leftClick !== 'boolean') p.options.leftClick = false
  if (typeof p.options.rightClick !== 'boolean') p.options.rightClick = false
  if (typeof p.options.sequenceMode !== 'boolean') p.options.sequenceMode = false
  if (!(typeof p.options.defaultDelayMs === 'number' && p.options.defaultDelayMs >= 0)) {
    p.options.defaultDelayMs = defaultProfile.options.defaultDelayMs
  }

  // Per-section UI state maps.
  p.sectionHeights =
    p.sectionHeights && typeof p.sectionHeights === 'object' ? p.sectionHeights : {}
  p.collapsedSections = asBoolMap(p.collapsedSections)
  p.hiddenSections = asBoolMap(p.hiddenSections)
  p.disabledSections = asBoolMap(p.disabledSections)

  // Macro.
  if (!p.macro || typeof p.macro !== 'object') p.macro = { enabled: false, events: [] }
  if (typeof p.macro.enabled !== 'boolean') p.macro.enabled = false
  if (!Array.isArray(p.macro.events)) p.macro.events = []
  p.macro.events = p.macro.events.filter(
    (e) => !!e && typeof e === 'object' && typeof e.type === 'string'
  )

  // Detection triggers (added in 1.41): default to an enabled, empty section.
  if (!p.detection || typeof p.detection !== 'object') {
    p.detection = { enabled: true, pollMs: DETECTION_POLL_DEFAULT_MS, triggers: [] }
  }
  if (typeof p.detection.enabled !== 'boolean') p.detection.enabled = true
  p.detection.pollMs = Number.isFinite(p.detection.pollMs)
    ? Math.min(DETECTION_POLL_MAX_MS, Math.max(DETECTION_POLL_MIN_MS, Math.round(p.detection.pollMs)))
    : DETECTION_POLL_DEFAULT_MS
  if (!Array.isArray(p.detection.triggers)) p.detection.triggers = []
  p.detection.triggers = p.detection.triggers.slice(0, 100).map(fixDetectionTrigger)

  // v1.33 split "Keys to Spam" (spam + periodic) into Tap keys + Timers, and
  // "Hold Actions" into Hold keys down + Hold triggers. Carry old master
  // switches, visibility, and layout positions over to the split cards.
  migrateSplitSections(p)
  // Draggable section order was added later; normalise (adds any new sections).
  p.sectionLayout = normalizeLayout(p.sectionLayout)
}

/** Map the pre-1.33 'keys' / 'holdActions' section ids onto the split cards. */
function migrateSplitSections(p: Profile): void {
  // Layout: replace 'holdActions' with the two new cards and slot 'timers' in
  // right after 'keys', but only for genuinely old layouts — never reshuffle a
  // layout the user has already arranged with the new ids.
  const layout = p.sectionLayout as { left?: string[]; right?: string[] } | null | undefined
  if (layout) {
    const all = [...(layout.left ?? []), ...(layout.right ?? [])]
    const isOldLayout = all.includes('holdActions') && !all.includes('holdKeys')
    if (isOldLayout) {
      const expand = (arr?: string[]): string[] =>
        (arr ?? []).flatMap((id) =>
          id === 'keys' && !all.includes('timers')
            ? ['keys', 'timers']
            : id === 'holdActions'
              ? ['holdKeys', 'holdTriggers']
              : [id]
        )
      layout.left = expand(layout.left)
      layout.right = expand(layout.right)
    }
  }

  // Master Enabled switches: the old section masters become the new cards'
  // feature flags ('Hold triggers' keeps using disabledSections — it has none).
  const d = p.disabledSections as Record<string, boolean>
  if (d?.keys === true) {
    p.options.enableKeys = false
    p.periodicKey.enabled = false
    delete d.keys
  }
  if (d?.holdActions === true) {
    p.holdKeys.enabled = false
    d.holdTriggers = true
    delete d.holdActions
  }

  const h = p.hiddenSections as Record<string, boolean>
  if (h?.keys === true) h.timers = true // 'keys' itself is still a valid id
  if (h?.holdActions === true) {
    h.holdKeys = true
    h.holdTriggers = true
    delete h.holdActions
  }

  const c = p.collapsedSections as Record<string, boolean>
  if (c?.holdActions === true) {
    c.holdKeys = true
    c.holdTriggers = true
    delete c.holdActions
  }
  if (p.sectionHeights && 'holdActions' in p.sectionHeights) {
    delete p.sectionHeights['holdActions']
  }
}

/**
 * Parse an exported profile file's JSON into a fresh, fully sanitized Profile
 * (new id, so it can never collide with existing profiles). Accepts the
 * wrapped export format, or a bare profile object for hand-edited files.
 * Throws an Error with a user-readable message when the file isn't a profile.
 */
export function profileFromExport(raw: unknown): Profile {
  const invalid = new Error("That file isn't a valid Monit profile.")
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw invalid

  const box = raw as { type?: unknown; profile?: unknown; options?: unknown; entries?: unknown }
  const src =
    box.type === PROFILE_FILE_TYPE
      ? box.profile
      : box.options && typeof box.options === 'object' && Array.isArray(box.entries)
        ? raw
        : null
  if (!src || typeof src !== 'object' || Array.isArray(src)) throw invalid

  const def = createDefaultProfile()
  const prof = { ...def, ...(src as Partial<Profile>) } as Profile
  prof.id = makeId('profile')
  if (typeof prof.name !== 'string' || prof.name.trim() === '') prof.name = 'Imported profile'
  sanitizeProfile(prof, def)
  return prof
}

/** "Main" → "Main (2)" → "Main (3)" … until the name is free. */
export function uniqueProfileName(name: string, existing: string[]): string {
  const taken = new Set(existing)
  if (!taken.has(name)) return name
  for (let i = 2; ; i++) {
    const candidate = `${name} (${i})`
    if (!taken.has(candidate)) return candidate
  }
}

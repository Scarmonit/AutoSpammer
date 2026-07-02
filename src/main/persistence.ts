import { app } from 'electron'
import { promises as fs, writeFileSync } from 'fs'
import { join } from 'path'
import type { PersistedData, Profile, AppSettings } from '@shared/types'
import { createDefaultData, DATA_VERSION, makeId } from '@shared/defaults'
import { normalizeLayout } from '@shared/sections'

const FILE_NAME = 'autospammer-data.json'

function dataPath(): string {
  return join(app.getPath('userData'), FILE_NAME)
}

let writeTimer: NodeJS.Timeout | null = null
let pending: PersistedData | null = null

/** Load persisted data, falling back to defaults on first run or corruption. */
export async function loadData(): Promise<PersistedData> {
  try {
    const raw = await fs.readFile(dataPath(), 'utf-8')
    const parsed = JSON.parse(raw) as PersistedData
    return migrate(parsed)
  } catch {
    const fresh = createDefaultData()
    await writeNow(fresh)
    return fresh
  }
}

/** Coerce loaded data into a valid, current-version shape. */
function migrate(data: PersistedData): PersistedData {
  if (!data || !Array.isArray(data.profiles) || data.profiles.length === 0) {
    return createDefaultData()
  }
  data.version = DATA_VERSION

  const defaults = createDefaultData()
  const defaultProfile = defaults.profiles[0]
  // Backfill fields added in newer versions so older saves stay valid.
  data.settings = { ...defaults.settings, ...data.settings }
  // The periodic (F9) and hold-keys (F8) toggle hotkeys were removed; drop them
  // from older saves.
  delete (data.settings as unknown as Record<string, unknown>).periodicKeyHotkey
  delete (data.settings as unknown as Record<string, unknown>).holdKeysHotkey
  if (typeof data.settings.showHints !== 'boolean') data.settings.showHints = true
  if (typeof data.settings.showSummaryBar !== 'boolean') data.settings.showSummaryBar = true
  // UI scale was added later; keep it a sane zoom factor.
  data.settings.uiScale = Math.min(2.5, Math.max(1, Number(data.settings.uiScale) || 1))
  // Close-to-tray toggle was added later; default older saves to "minimize to tray".
  if (typeof data.settings.minimizeToTrayOnClose !== 'boolean') {
    data.settings.minimizeToTrayOnClose = true
  }
  for (const p of data.profiles) {
    if (!Array.isArray(p.clickPositions)) p.clickPositions = []
    if (!p.holdKeys || !Array.isArray(p.holdKeys.keys)) p.holdKeys = { enabled: true, keys: [] }
    // Hold Keys Down gained an "enabled" switch later; default older saves to on.
    if (typeof p.holdKeys.enabled !== 'boolean') p.holdKeys.enabled = true
    if (!p.periodicKey || typeof p.periodicKey !== 'object') {
      p.periodicKey = { ...defaultProfile.periodicKey }
    }
    // Periodic Key gained an "enabled" switch later; default older saves to on.
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
    if (!p.rightClickHold) p.rightClickHold = { ...defaultProfile.rightClickHold }
    if (!p.options) p.options = { ...defaultProfile.options }
    // Section master switches were added later — default older saves to "on" so
    // their existing keys/positions keep spamming exactly as before.
    if (typeof p.options.enableKeys !== 'boolean') p.options.enableKeys = true
    if (typeof p.options.enableClickPositions !== 'boolean') p.options.enableClickPositions = true
    // Resizable-layout heights were added later; older saves start unsized.
    if (!p.sectionHeights || typeof p.sectionHeights !== 'object') p.sectionHeights = {}
    // Collapsed-section state was added later; older saves start all-expanded.
    if (!p.collapsedSections || typeof p.collapsedSections !== 'object') p.collapsedSections = {}
    // Section visibility was added later; older saves start with all visible.
    if (!p.hiddenSections || typeof p.hiddenSections !== 'object') p.hiddenSections = {}
    // Per-section master enable was added later; older saves start all enabled.
    if (!p.disabledSections || typeof p.disabledSections !== 'object') p.disabledSections = {}
    // The macro recorder was added later; older saves start with an empty macro.
    if (!p.macro || typeof p.macro !== 'object') p.macro = { enabled: false, events: [] }
    if (!Array.isArray(p.macro.events)) p.macro.events = []
    // v1.33 split "Keys to Spam" (spam + periodic) into Tap keys + Timers, and
    // "Hold Actions" into Hold keys down + Hold triggers. Carry old master
    // switches, visibility, and layout positions over to the split cards.
    migrateSplitSections(p)
    // Draggable section order was added later; normalise (adds any new sections).
    p.sectionLayout = normalizeLayout(p.sectionLayout)
  }

  // Ensure the active profile id points at something real.
  if (!data.profiles.some((p) => p.id === data.settings.activeProfileId)) {
    data.settings.activeProfileId = data.profiles[0].id
  }
  return data
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

async function writeNow(data: PersistedData): Promise<void> {
  await fs.writeFile(dataPath(), JSON.stringify(data, null, 2), 'utf-8')
}

/** Debounced save to avoid hammering the disk while the user edits fields. */
export function saveData(data: PersistedData): void {
  pending = data
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = setTimeout(() => {
    if (pending) void writeNow(pending)
    writeTimer = null
  }, 250)
}

/** Force any pending write to flush immediately (called on quit). */
export async function flushData(): Promise<void> {
  if (writeTimer) {
    clearTimeout(writeTimer)
    writeTimer = null
  }
  if (pending) await writeNow(pending)
}

/** Synchronous flush for use during app shutdown (no awaiting on quit). */
export function flushDataSync(): void {
  if (writeTimer) {
    clearTimeout(writeTimer)
    writeTimer = null
  }
  if (pending) {
    try {
      writeFileSync(dataPath(), JSON.stringify(pending, null, 2), 'utf-8')
    } catch {
      /* best effort on shutdown */
    }
  }
}

export function findProfile(data: PersistedData, id: string): Profile | undefined {
  return data.profiles.find((p) => p.id === id)
}

export function activeProfile(data: PersistedData): Profile {
  return findProfile(data, data.settings.activeProfileId) ?? data.profiles[0]
}

export type { PersistedData, Profile, AppSettings }

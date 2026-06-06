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
    // The macro recorder was added later; older saves start with an empty macro.
    if (!p.macro || typeof p.macro !== 'object') p.macro = { enabled: false, events: [] }
    if (!Array.isArray(p.macro.events)) p.macro.events = []
    // Draggable section order was added later; normalise (adds any new sections).
    p.sectionLayout = normalizeLayout(p.sectionLayout)
  }

  // Ensure the active profile id points at something real.
  if (!data.profiles.some((p) => p.id === data.settings.activeProfileId)) {
    data.settings.activeProfileId = data.profiles[0].id
  }
  return data
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

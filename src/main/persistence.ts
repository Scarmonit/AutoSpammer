import { app } from 'electron'
import { promises as fs, writeFileSync } from 'fs'
import { join } from 'path'
import type { PersistedData, Profile, AppSettings } from '@shared/types'
import { createDefaultData, DATA_VERSION } from '@shared/defaults'
import { sanitizeProfile } from '@shared/profileio'

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
  // Backfill/repair every profile (shared with the .monit import path).
  for (const p of data.profiles) sanitizeProfile(p, defaultProfile)

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

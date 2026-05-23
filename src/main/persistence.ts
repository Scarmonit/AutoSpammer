import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { PersistedData, Profile, AppSettings } from '@shared/types'
import { createDefaultData, DATA_VERSION } from '@shared/defaults'

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
  // Backfill fields added in newer versions so older saves stay valid.
  data.settings = { ...defaults.settings, ...data.settings }
  for (const p of data.profiles) {
    if (!Array.isArray(p.clickPositions)) p.clickPositions = []
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

export function findProfile(data: PersistedData, id: string): Profile | undefined {
  return data.profiles.find((p) => p.id === id)
}

export function activeProfile(data: PersistedData): Profile {
  return findProfile(data, data.settings.activeProfileId) ?? data.profiles[0]
}

export type { PersistedData, Profile, AppSettings }

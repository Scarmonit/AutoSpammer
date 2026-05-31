import type { Profile, AppSettings, PersistedData } from './types'

export const DATA_VERSION = 1

let counter = 0
/** Small id helper that works in both main and renderer. */
export function makeId(prefix = 'id'): string {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`
}

export function createDefaultProfile(name = 'Default'): Profile {
  return {
    id: makeId('profile'),
    name,
    entries: [
      { id: makeId('key'), kind: 'key', key: 'space', delayMs: null },
      { id: makeId('key'), kind: 'key', key: '1', delayMs: null }
    ],
    options: {
      spacebar: false,
      leftClick: false,
      rightClick: false,
      defaultDelayMs: 10,
      sequenceMode: false,
      enableKeys: true,
      enableClickPositions: true
    },
    textFunction: {
      enabled: false,
      text: 'gg',
      delayMs: 25
    },
    clickPositions: [],
    holdKeys: {
      keys: []
    },
    periodicKey: {
      key: 'f',
      intervalSec: 5
    },
    loop: {
      mode: 'forever',
      count: 10
    },
    holdToSpam: {
      enabled: false,
      key: '',
      delayMs: 10
    },
    focusHold: {
      enabled: false,
      key: '',
      delayMs: 10
    },
    rightClickHold: {
      enabled: false,
      key: '',
      delayMs: 10
    },
    sectionHeights: {},
    collapsedSections: {}
  }
}

export function createDefaultSettings(activeProfileId: string): AppSettings {
  return {
    toggleHotkey: 'F6',
    emergencyHotkey: 'Escape',
    recordPositionHotkey: 'F7',
    holdKeysHotkey: 'F8',
    periodicKeyHotkey: 'F9',
    activeProfileId
  }
}

export function createDefaultData(): PersistedData {
  const profile = createDefaultProfile()
  return {
    version: DATA_VERSION,
    settings: createDefaultSettings(profile.id),
    profiles: [profile]
  }
}

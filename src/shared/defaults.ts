import type { Profile, AppSettings, PersistedData, DetectionTrigger } from './types'
import { cloneDefaultLayout } from './sections'

export const DATA_VERSION = 1

let counter = 0
/** Small id helper that works in both main and renderer. */
export function makeId(prefix = 'id'): string {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`
}

/** A fresh, empty detection trigger (color mode, nothing captured yet). */
export function createDefaultDetectionTrigger(): DetectionTrigger {
  return {
    id: makeId('det'),
    enabled: true,
    mode: 'color',
    x: 0,
    y: 0,
    color: '',
    // Game UI glows/pulses; a roomy default avoids near-miss frustration.
    tolerance: 25,
    // Re-press ~10×/s while the condition holds, so an interrupted cast retries.
    repeatMs: 100,
    // Bridge brief icon flashes / global-cooldown dims so the spam doesn't stop
    // on a momentary miss; still stops ~⅓s after the ability truly goes down.
    lingerMs: 300,
    image: null,
    searchArea: null,
    action: { kind: 'key', key: '', positionId: '' }
  }
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
      enabled: true,
      keys: []
    },
    periodicKey: {
      enabled: true,
      entries: []
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
    collapsedSections: {},
    hiddenSections: {},
    disabledSections: {},
    macro: {
      enabled: false,
      events: []
    },
    detection: {
      enabled: true,
      pollMs: 100,
      triggers: []
    },
    sectionLayout: cloneDefaultLayout()
  }
}

export function createDefaultSettings(activeProfileId: string): AppSettings {
  return {
    toggleHotkey: 'F6',
    emergencyHotkey: 'Escape',
    recordPositionHotkey: 'F7',
    macroRecordHotkey: 'F10',
    uiScale: 1,
    showHints: true,
    showSummaryBar: true,
    minimizeToTrayOnClose: true,
    windowBounds: null,
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

import { describe, it, expect } from 'vitest'
import {
  createDefaultData,
  createDefaultProfile,
  createDefaultSettings,
  makeId,
  DATA_VERSION
} from '@shared/defaults'

describe('defaults', () => {
  it('creates a complete default profile', () => {
    const p = createDefaultProfile('My Profile')
    expect(p.name).toBe('My Profile')
    expect(Array.isArray(p.entries)).toBe(true)
    expect(Array.isArray(p.clickPositions)).toBe(true)
    expect(Array.isArray(p.holdKeys.keys)).toBe(true)
    expect(Array.isArray(p.periodicKey.entries)).toBe(true)
    expect(typeof p.periodicKey.enabled).toBe('boolean')
    expect(p.options.defaultDelayMs).toBeGreaterThanOrEqual(0)
    expect(['forever', 'once', 'count']).toContain(p.loop.mode)
  })

  it('creates settings with all hotkeys and a valid active profile id', () => {
    const s = createDefaultSettings('abc')
    expect(s.activeProfileId).toBe('abc')
    for (const k of [
      'toggleHotkey',
      'emergencyHotkey',
      'recordPositionHotkey'
    ] as const) {
      expect(typeof s[k]).toBe('string')
      expect(s[k].length).toBeGreaterThan(0)
    }
  })

  it('default data is internally consistent', () => {
    const d = createDefaultData()
    expect(d.version).toBe(DATA_VERSION)
    expect(d.profiles.length).toBeGreaterThan(0)
    expect(d.profiles.some((p) => p.id === d.settings.activeProfileId)).toBe(true)
  })

  it('makeId produces unique ids', () => {
    const ids = new Set(Array.from({ length: 500 }, () => makeId('x')))
    expect(ids.size).toBe(500)
  })
})

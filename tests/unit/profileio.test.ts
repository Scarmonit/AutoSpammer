import { describe, it, expect } from 'vitest'
import {
  exportPayload,
  profileFromExport,
  sanitizeProfile,
  uniqueProfileName,
  PROFILE_FILE_TYPE
} from '@shared/profileio'
import { createDefaultProfile } from '@shared/defaults'
import { SECTION_IDS } from '@shared/sections'

describe('profile export / import round-trip', () => {
  it('a full profile survives export -> JSON -> import intact', () => {
    const p = createDefaultProfile('My build')
    p.entries = [{ id: 'k1', kind: 'key', key: 'q', delayMs: 25 }]
    p.options.spacebar = true
    p.options.sequenceMode = true
    p.periodicKey.entries = [{ id: 'pk1', key: '1', intervalSec: 2.5 }]
    p.holdKeys.keys = ['w', 'mouse-right']
    p.holdToSpam = { enabled: true, key: 'x', delayMs: 15 }
    p.loop = { mode: 'count', count: 7 }
    p.hiddenSections = { macro: true }
    p.textFunction = { enabled: true, text: 'gg', delayMs: 30 }

    const roundTripped = profileFromExport(JSON.parse(JSON.stringify(exportPayload(p))))

    // A fresh id (never collides with existing profiles), same content.
    expect(roundTripped.id).not.toBe(p.id)
    expect(roundTripped.name).toBe('My build')
    expect(roundTripped.entries).toEqual(p.entries)
    expect(roundTripped.options).toEqual(p.options)
    expect(roundTripped.periodicKey).toEqual(p.periodicKey)
    expect(roundTripped.holdKeys).toEqual(p.holdKeys)
    expect(roundTripped.holdToSpam).toEqual(p.holdToSpam)
    expect(roundTripped.loop).toEqual(p.loop)
    expect(roundTripped.hiddenSections).toEqual({ macro: true })
    expect(roundTripped.textFunction).toEqual(p.textFunction)
  })

  it('the export envelope is marked so random JSON cannot pass for a profile', () => {
    expect(exportPayload(createDefaultProfile()).type).toBe(PROFILE_FILE_TYPE)
  })
})

describe('profileFromExport validation', () => {
  it('rejects non-profile JSON with a readable error', () => {
    for (const bad of [null, 42, 'hello', [], {}, { type: 'other' }, { type: PROFILE_FILE_TYPE }]) {
      expect(() => profileFromExport(bad)).toThrow(/valid Monit profile/i)
    }
  })

  it('accepts a bare profile object (hand-copied from the save file)', () => {
    const bare = createDefaultProfile('Bare')
    const imported = profileFromExport(JSON.parse(JSON.stringify(bare)))
    expect(imported.name).toBe('Bare')
    expect(imported.id).not.toBe(bare.id)
  })

  it('repairs bad fields instead of importing garbage', () => {
    const p = createDefaultProfile('Messy') as unknown as Record<string, unknown>
    p.entries = [null, { key: 42 }, { id: '', kind: 'nope', key: 'a', delayMs: -5 }]
    p.periodicKey = { enabled: 'yes', entries: [{ key: 'f', intervalSec: -1 }] }
    p.loop = { mode: 'bogus', count: 'x' }
    p.holdToSpam = 'not-an-object'
    p.holdKeys = { enabled: 1, keys: ['w', 7, null] }

    const imported = profileFromExport({ type: PROFILE_FILE_TYPE, version: 1, profile: p })
    // Junk entries got coerced: valid rows survive with safe values.
    expect(imported.entries).toHaveLength(2)
    expect(imported.entries[1]).toMatchObject({ kind: 'key', key: 'a', delayMs: null })
    expect(imported.entries.every((e) => e.id.length > 0)).toBe(true)
    expect(imported.periodicKey.entries).toEqual([
      expect.objectContaining({ key: 'f', intervalSec: 5 })
    ])
    expect(imported.loop.mode).toBe('forever')
    expect(imported.holdToSpam).toMatchObject({ enabled: false, key: '' })
    expect(imported.holdKeys.keys).toEqual(['w'])
  })

  it('migrates a pre-1.33 export (old section ids) onto the split cards', () => {
    const p = createDefaultProfile('Old export') as unknown as Record<string, unknown>
    p.sectionLayout = { left: ['keys', 'clickPositions'], right: ['holdActions', 'macro'] }
    p.disabledSections = { holdActions: true }
    const imported = profileFromExport({ type: PROFILE_FILE_TYPE, version: 1, profile: p })
    const all = [...imported.sectionLayout.left, ...imported.sectionLayout.right]
    expect([...all].sort()).toEqual([...SECTION_IDS].sort())
    expect(imported.disabledSections).toEqual({ holdTriggers: true })
    expect(imported.holdKeys.enabled).toBe(false)
  })
})

describe('sanitizeProfile is a no-op on already-valid profiles', () => {
  it('leaves a default profile unchanged (apart from nothing)', () => {
    const p = createDefaultProfile('Stable')
    const snapshot = JSON.parse(JSON.stringify(p))
    sanitizeProfile(p, createDefaultProfile())
    expect(JSON.parse(JSON.stringify(p))).toEqual(snapshot)
  })
})

describe('uniqueProfileName', () => {
  it('keeps a free name and suffixes taken ones', () => {
    expect(uniqueProfileName('Main', ['Other'])).toBe('Main')
    expect(uniqueProfileName('Main', ['Main'])).toBe('Main (2)')
    expect(uniqueProfileName('Main', ['Main', 'Main (2)', 'Main (3)'])).toBe('Main (4)')
  })
})

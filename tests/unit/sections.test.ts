import { describe, it, expect } from 'vitest'
import {
  SECTION_IDS,
  DEFAULT_LAYOUT,
  normalizeLayout,
  moveSection,
  isSectionHidden,
  applyHiddenSections
} from '@shared/sections'
import { createDefaultProfile } from '@shared/defaults'

describe('normalizeLayout', () => {
  it('keeps a valid layout intact', () => {
    const out = normalizeLayout(DEFAULT_LAYOUT)
    expect(out).toEqual(DEFAULT_LAYOUT)
  })

  it('drops unknowns, removes duplicates, and appends missing sections', () => {
    const out = normalizeLayout({ left: ['keys', 'keys', 'bogus'], right: ['periodicKey'] })
    const all = [...out.left, ...out.right]
    // every known section appears exactly once
    expect([...all].sort()).toEqual([...SECTION_IDS].sort())
    expect(all.filter((id) => id === 'keys')).toHaveLength(1)
    expect(all).not.toContain('bogus')
    // explicitly placed ones keep their column/position
    expect(out.left[0]).toBe('keys')
    expect(out.right[0]).toBe('periodicKey')
  })

  it('falls back to a full default-shaped layout for null/empty input', () => {
    const out = normalizeLayout(null)
    expect([...out.left, ...out.right].sort()).toEqual([...SECTION_IDS].sort())
  })
})

describe('moveSection', () => {
  it('reorders within a column (downward, with the off-by-one handled)', () => {
    // Move "clickPositions" to the very end of the default left column.
    const l = normalizeLayout(DEFAULT_LAYOUT)
    const out = moveSection(l, 'clickPositions', 'left', l.left.length)
    expect(out.left[out.left.length - 1]).toBe('clickPositions')
    expect([...out.left, ...out.right].sort()).toEqual([...SECTION_IDS].sort())
  })

  it('moves a section to the other column at a chosen index', () => {
    const l = normalizeLayout(DEFAULT_LAYOUT)
    const out = moveSection(l, 'keys', 'right', 1)
    expect(out.left).not.toContain('keys')
    expect(out.right[1]).toBe('keys')
    // still complete + unique
    expect([...out.left, ...out.right].sort()).toEqual([...SECTION_IDS].sort())
  })

  it('keeps the layout complete and unique after several moves', () => {
    let l = normalizeLayout(DEFAULT_LAYOUT)
    l = moveSection(l, 'macro', 'right', 0)
    l = moveSection(l, 'periodicKey', 'left', 2)
    l = moveSection(l, 'keys', 'right', l.right.length)
    expect([...l.left, ...l.right].sort()).toEqual([...SECTION_IDS].sort())
  })
})

describe('section visibility', () => {
  it('isSectionHidden only treats === true as hidden', () => {
    expect(isSectionHidden({ keys: true }, 'keys')).toBe(true)
    expect(isSectionHidden({ keys: true }, 'periodicKey')).toBe(false)
    expect(isSectionHidden({}, 'keys')).toBe(false)
    expect(isSectionHidden(null, 'keys')).toBe(false)
  })

  it('applyHiddenSections disables a hidden section feature without mutating flags', () => {
    const p = createDefaultProfile()
    p.options.enableKeys = true
    p.options.enableClickPositions = true
    p.textFunction.enabled = true
    p.periodicKey.enabled = true
    p.hiddenSections = { keys: true, textFunction: true, periodicKey: true }

    const eff = applyHiddenSections(p)
    // Hidden features are off in the effective profile...
    expect(eff.options.enableKeys).toBe(false)
    expect(eff.textFunction.enabled).toBe(false)
    expect(eff.periodicKey.enabled).toBe(false)
    // ...a visible feature is left alone...
    expect(eff.options.enableClickPositions).toBe(true)
    // ...and the stored profile flags are untouched (re-showing restores them).
    expect(p.options.enableKeys).toBe(true)
    expect(p.textFunction.enabled).toBe(true)
  })

  it('hiding the merged Hold Modes section disables all three hold modes', () => {
    const p = createDefaultProfile()
    p.holdToSpam.enabled = true
    p.focusHold.enabled = true
    p.rightClickHold.enabled = true
    p.hiddenSections = { holdModes: true }

    const eff = applyHiddenSections(p)
    expect(eff.holdToSpam.enabled).toBe(false)
    expect(eff.focusHold.enabled).toBe(false)
    expect(eff.rightClickHold.enabled).toBe(false)
    // Stored flags untouched so re-showing restores them.
    expect(p.holdToSpam.enabled).toBe(true)
    expect(p.focusHold.enabled).toBe(true)
    expect(p.rightClickHold.enabled).toBe(true)
  })

  it('applyHiddenSections is a no-op when nothing is hidden', () => {
    const p = createDefaultProfile()
    expect(applyHiddenSections(p)).toBe(p)
  })
})

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
    const out = normalizeLayout({ left: ['keys', 'keys', 'bogus'], right: ['macro'] })
    const all = [...out.left, ...out.right]
    // every known section appears exactly once
    expect([...all].sort()).toEqual([...SECTION_IDS].sort())
    expect(all.filter((id) => id === 'keys')).toHaveLength(1)
    expect(all).not.toContain('bogus')
    // explicitly placed ones keep their column/position
    expect(out.left[0]).toBe('keys')
    expect(out.right[0]).toBe('macro')
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
    l = moveSection(l, 'textFunction', 'left', 1)
    l = moveSection(l, 'keys', 'right', l.right.length)
    expect([...l.left, ...l.right].sort()).toEqual([...SECTION_IDS].sort())
  })
})

describe('section visibility', () => {
  it('isSectionHidden only treats === true as hidden', () => {
    expect(isSectionHidden({ keys: true }, 'keys')).toBe(true)
    expect(isSectionHidden({ keys: true }, 'clickPositions')).toBe(false)
    expect(isSectionHidden({}, 'keys')).toBe(false)
    expect(isSectionHidden(null, 'keys')).toBe(false)
  })

  it('hiding a card disables exactly what it contains', () => {
    const p = createDefaultProfile()
    p.options.enableKeys = true
    p.options.enableClickPositions = true
    p.periodicKey.enabled = true
    p.holdKeys.enabled = true
    p.holdToSpam.enabled = true
    p.focusHold.enabled = true
    p.rightClickHold.enabled = true
    p.hiddenSections = { keys: true, timers: true, holdKeys: true, holdTriggers: true }

    const eff = applyHiddenSections(p)
    expect(eff.options.enableKeys).toBe(false) // Tap keys
    expect(eff.periodicKey.enabled).toBe(false) // Timers
    expect(eff.holdKeys.enabled).toBe(false) // Hold keys down
    // Hold triggers (all three modes)...
    expect(eff.holdToSpam.enabled).toBe(false)
    expect(eff.focusHold.enabled).toBe(false)
    expect(eff.rightClickHold.enabled).toBe(false)
    // A visible feature is left alone.
    expect(eff.options.enableClickPositions).toBe(true)
    // Stored profile flags are untouched (re-showing restores them).
    expect(p.options.enableKeys).toBe(true)
    expect(p.holdKeys.enabled).toBe(true)
    expect(p.holdToSpam.enabled).toBe(true)
  })

  it('hiding one split card leaves its former sibling running', () => {
    const p = createDefaultProfile()
    p.options.enableKeys = true
    p.periodicKey.enabled = true
    p.holdKeys.enabled = true
    p.holdToSpam.enabled = true
    p.hiddenSections = { timers: true, holdTriggers: true }

    const eff = applyHiddenSections(p)
    expect(eff.periodicKey.enabled).toBe(false)
    expect(eff.holdToSpam.enabled).toBe(false)
    // Tap keys and Hold keys down are separate cards now — unaffected.
    expect(eff.options.enableKeys).toBe(true)
    expect(eff.holdKeys.enabled).toBe(true)
  })

  it('the Hold triggers master switch (disabledSections) skips the three modes', () => {
    const p = createDefaultProfile()
    p.holdKeys.enabled = true
    p.holdToSpam.enabled = true
    p.focusHold.enabled = true
    p.rightClickHold.enabled = true
    // The card is visible, but its master switch is off.
    p.disabledSections = { holdTriggers: true }

    const eff = applyHiddenSections(p)
    expect(eff.holdToSpam.enabled).toBe(false)
    expect(eff.focusHold.enabled).toBe(false)
    expect(eff.rightClickHold.enabled).toBe(false)
    // Hold keys down has its own card + flag — unaffected.
    expect(eff.holdKeys.enabled).toBe(true)
    // Stored flags untouched (re-enabling the card restores them).
    expect(p.holdToSpam.enabled).toBe(true)
  })

  it('applyHiddenSections is a no-op when nothing is hidden or disabled', () => {
    const p = createDefaultProfile()
    expect(applyHiddenSections(p)).toBe(p)
  })
})

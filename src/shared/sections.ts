// The set of draggable UI sections and helpers for their two-column layout.
// Pure and dependency-free (type-only Profile import) so both the renderer and
// the main process can keep a profile's custom order/visibility valid no matter
// how it was edited.

import type { Profile } from './types'

export type SectionColumnName = 'left' | 'right'

export interface SectionLayout {
  left: string[]
  right: string[]
}

/** Every section id the app knows about (used to reconcile saved layouts). */
export const SECTION_IDS = [
  'keys',
  'timers',
  'holdKeys',
  'holdTriggers',
  'clickPositions',
  'textFunction',
  'macro',
  'detection'
] as const

export type SectionId = (typeof SECTION_IDS)[number]

/** Human-readable names, matching each section's on-screen header title. */
export const SECTION_LABELS: Record<string, string> = {
  keys: 'Tap keys',
  timers: 'Timed key presses',
  holdKeys: 'Hold keys down',
  holdTriggers: 'Hold triggers',
  clickPositions: 'Click positions',
  textFunction: 'Text function',
  macro: 'Macro',
  detection: 'Detection triggers'
}

/** Accent color per section: the title dot + its header switch. */
export const SECTION_ACCENTS: Record<string, string> = {
  keys: '#3b82f6',
  timers: '#eab308',
  holdKeys: '#3ddc84',
  holdTriggers: '#a78bfa',
  clickPositions: '#f472b6',
  textFunction: '#22d3ee',
  macro: '#e879f9',
  detection: '#fb923c'
}

/** The out-of-the-box arrangement. */
export const DEFAULT_LAYOUT: SectionLayout = {
  left: ['keys', 'timers', 'clickPositions', 'detection'],
  right: ['holdKeys', 'holdTriggers', 'textFunction', 'macro']
}

export function cloneDefaultLayout(): SectionLayout {
  return { left: [...DEFAULT_LAYOUT.left], right: [...DEFAULT_LAYOUT.right] }
}

/**
 * Coerce a (possibly partial / stale / duplicated) layout into a valid one that
 * contains every known section exactly once: unknown ids are dropped, duplicates
 * removed, and any missing sections appended to their default column. This keeps
 * the UI stable across reorders and when new sections are added in future builds.
 */
export function normalizeLayout(layout: Partial<SectionLayout> | null | undefined): SectionLayout {
  const known = new Set<string>(SECTION_IDS)
  const seen = new Set<string>()

  const clean = (arr: string[] | undefined): string[] => {
    const out: string[] = []
    for (const id of arr ?? []) {
      if (known.has(id) && !seen.has(id)) {
        seen.add(id)
        out.push(id)
      }
    }
    return out
  }

  const left = clean(layout?.left)
  const right = clean(layout?.right)

  for (const id of SECTION_IDS) {
    if (seen.has(id)) continue
    seen.add(id)
    if (DEFAULT_LAYOUT.left.includes(id)) left.push(id)
    else right.push(id)
  }

  return { left, right }
}

/**
 * Move `id` to `toCol` at the given display index (the index measured against the
 * column as currently shown, which still includes the dragged item). Returns a
 * fresh, normalized layout.
 */
export function moveSection(
  layout: SectionLayout,
  id: string,
  toCol: SectionColumnName,
  index: number
): SectionLayout {
  const fromCol: SectionColumnName | null = layout.left.includes(id)
    ? 'left'
    : layout.right.includes(id)
      ? 'right'
      : null
  if (fromCol === null) return normalizeLayout(layout)

  const next: SectionLayout = {
    left: layout.left.filter((x) => x !== id),
    right: layout.right.filter((x) => x !== id)
  }

  let target = index
  if (fromCol === toCol) {
    const origIndex = layout[toCol].indexOf(id)
    if (origIndex !== -1 && origIndex < index) target -= 1
  }

  const arr = next[toCol]
  target = Math.max(0, Math.min(arr.length, target))
  arr.splice(target, 0, id)

  return normalizeLayout(next)
}

/** True when a section id is marked hidden in the visibility map. */
export function isSectionHidden(
  hidden: Record<string, boolean> | null | undefined,
  id: string
): boolean {
  return !!hidden && hidden[id] === true
}

/**
 * Return the profile with every hidden/master-disabled section's runtime feature
 * forced off, so it never participates in a spam run (Start Spam / F6 / hold
 * triggers). The stored enable flags are untouched — re-showing a section
 * restores its original behaviour.
 *
 * Most cards' header switch IS their feature flag (enableKeys, periodicKey,
 * holdKeys, textFunction, macro, enableClickPositions); "Hold triggers" has no
 * single flag, so its header switch lives in disabledSections['holdTriggers'].
 */
export function applyHiddenSections(profile: Profile): Profile {
  const h = profile.hiddenSections
  const d = profile.disabledSections
  const noHidden = !h || Object.keys(h).length === 0
  const noDisabled = !d || Object.keys(d).length === 0
  if (noHidden && noDisabled) return profile

  const off = (id: string): boolean => h?.[id] === true || d?.[id] === true
  const triggersOff = off('holdTriggers')

  return {
    ...profile,
    options: {
      ...profile.options,
      enableKeys: profile.options.enableKeys && !off('keys'),
      enableClickPositions: profile.options.enableClickPositions && !off('clickPositions')
    },
    periodicKey: off('timers') ? { ...profile.periodicKey, enabled: false } : profile.periodicKey,
    holdKeys: off('holdKeys') ? { ...profile.holdKeys, enabled: false } : profile.holdKeys,
    textFunction: off('textFunction')
      ? { ...profile.textFunction, enabled: false }
      : profile.textFunction,
    macro: off('macro') ? { ...profile.macro, enabled: false } : profile.macro,
    detection:
      off('detection') && profile.detection
        ? { ...profile.detection, enabled: false }
        : profile.detection,
    holdToSpam: triggersOff ? { ...profile.holdToSpam, enabled: false } : profile.holdToSpam,
    focusHold: triggersOff ? { ...profile.focusHold, enabled: false } : profile.focusHold,
    rightClickHold: triggersOff
      ? { ...profile.rightClickHold, enabled: false }
      : profile.rightClickHold
  }
}

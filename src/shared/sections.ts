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
  'holdActions',
  'clickPositions',
  'textFunction',
  'macro'
] as const

export type SectionId = (typeof SECTION_IDS)[number]

/** Human-readable names, matching each section's on-screen header title. */
export const SECTION_LABELS: Record<string, string> = {
  keys: 'Keys to Spam',
  holdActions: 'Hold Actions',
  clickPositions: 'Click Positions',
  textFunction: 'Text Function',
  macro: 'Macro'
}

/** The out-of-the-box arrangement. */
export const DEFAULT_LAYOUT: SectionLayout = {
  left: ['keys', 'clickPositions'],
  right: ['holdActions', 'textFunction', 'macro']
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
 * Return the profile with every hidden section's runtime feature forced off, so
 * a hidden section never participates in a spam run (Start Spam / F6 / hold
 * triggers). The stored enable flags are untouched — re-showing a section
 * restores its original behaviour. Config-only sections (Profiles, Loop, Toggle
 * Hotkey) have no per-run feature to disable, so only the UI hides them.
 */
export function applyHiddenSections(profile: Profile): Profile {
  const h = profile.hiddenSections
  const d = profile.disabledSections
  const noHidden = !h || Object.keys(h).length === 0
  const noDisabled = !d || Object.keys(d).length === 0
  if (noHidden && noDisabled) return profile

  // A section's features don't run if it's hidden (Sections manager) OR its
  // master Enabled switch is off. "Keys to Spam" holds the Spam Keys list and
  // Periodic Actions; "Hold Actions" holds Hold Keys Down + the three hold modes.
  const off = (id: string): boolean => h?.[id] === true || d?.[id] === true
  const keysOff = off('keys')
  const holdOff = off('holdActions')

  return {
    ...profile,
    options: {
      ...profile.options,
      enableKeys: profile.options.enableKeys && !keysOff,
      enableClickPositions: profile.options.enableClickPositions && !off('clickPositions')
    },
    textFunction: off('textFunction')
      ? { ...profile.textFunction, enabled: false }
      : profile.textFunction,
    holdKeys: holdOff ? { ...profile.holdKeys, enabled: false } : profile.holdKeys,
    periodicKey: keysOff ? { ...profile.periodicKey, enabled: false } : profile.periodicKey,
    macro: off('macro') ? { ...profile.macro, enabled: false } : profile.macro,
    holdToSpam: holdOff ? { ...profile.holdToSpam, enabled: false } : profile.holdToSpam,
    focusHold: holdOff ? { ...profile.focusHold, enabled: false } : profile.focusHold,
    rightClickHold: holdOff
      ? { ...profile.rightClickHold, enabled: false }
      : profile.rightClickHold
  }
}

// The set of draggable UI sections and helpers for their two-column layout.
// Pure and dependency-free so both the renderer and the main process (sanitize)
// can keep a profile's custom order valid no matter how it was edited.

export type SectionColumnName = 'left' | 'right'

export interface SectionLayout {
  left: string[]
  right: string[]
}

/** Every section id the app knows about (used to reconcile saved layouts). */
export const SECTION_IDS = [
  'keys',
  'options',
  'clickPositions',
  'textFunction',
  'holdKeys',
  'macro',
  'profiles',
  'loop',
  'hotkeys',
  'holdToSpam',
  'focusHold',
  'rightClickHold',
  'periodicKey'
] as const

export type SectionId = (typeof SECTION_IDS)[number]

/** The out-of-the-box arrangement. */
export const DEFAULT_LAYOUT: SectionLayout = {
  left: ['keys', 'options', 'clickPositions', 'textFunction', 'holdKeys', 'macro'],
  right: ['profiles', 'loop', 'hotkeys', 'holdToSpam', 'focusHold', 'rightClickHold', 'periodicKey']
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

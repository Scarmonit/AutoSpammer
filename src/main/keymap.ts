import { Key } from '@nut-tree-fork/nut-js'
import { UiohookKey } from 'uiohook-napi'

// ---------------------------------------------------------------------------
// Simulation side (nut-js): logical key name -> nut-js Key enum member.
// Single printable characters that are not listed here are typed literally,
// so the table only needs to cover named / non-printable keys.
// ---------------------------------------------------------------------------
const NUT_SPECIAL: Record<string, keyof typeof Key> = {
  space: 'Space',
  enter: 'Return',
  return: 'Return',
  tab: 'Tab',
  escape: 'Escape',
  esc: 'Escape',
  backspace: 'Backspace',
  delete: 'Delete',
  insert: 'Insert',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  shift: 'LeftShift',
  ctrl: 'LeftControl',
  control: 'LeftControl',
  alt: 'LeftAlt',
  capslock: 'CapsLock',
  ...buildFunctionKeys()
}

function buildFunctionKeys(): Record<string, keyof typeof Key> {
  const out: Record<string, keyof typeof Key> = {}
  for (let i = 1; i <= 24; i++) {
    const name = `f${i}` as const
    const member = `F${i}` as keyof typeof Key
    if (member in Key) out[name] = member
  }
  return out
}

/** Resolve a logical key name to a nut-js Key, or null to type it literally. */
export function nutKeyFor(name: string): Key | null {
  const lower = name.trim().toLowerCase()
  const special = NUT_SPECIAL[lower]
  if (special && special in Key) return Key[special] as unknown as Key
  return null
}

// ---------------------------------------------------------------------------
// Listening side (uiohook): keycode <-> logical name.
// ---------------------------------------------------------------------------
const codeToName: Record<number, string> = (() => {
  const map: Record<number, string> = {}
  for (const [rawName, code] of Object.entries(UiohookKey)) {
    if (typeof code !== 'number') continue
    map[code] = normalizeUiohookName(rawName)
  }
  return map
})()

function normalizeUiohookName(raw: string): string {
  // Single letters -> lowercase (e.g. "A" -> "a").
  if (/^[A-Z]$/.test(raw)) return raw.toLowerCase()
  // Number row "0".."9" stay as-is; numpad variants prefixed.
  if (/^[0-9]$/.test(raw)) return raw
  const lower = raw.toLowerCase()
  const aliases: Record<string, string> = {
    arrowup: 'up',
    arrowdown: 'down',
    arrowleft: 'left',
    arrowright: 'right',
    // Punctuation -> literal character, so it types correctly when simulated.
    semicolon: ';',
    equal: '=',
    comma: ',',
    minus: '-',
    period: '.',
    slash: '/',
    backquote: '`',
    bracketleft: '[',
    backslash: '\\',
    bracketright: ']',
    quote: "'"
  }
  return aliases[lower] ?? lower
}

/** Friendly logical name for a uiohook keycode (used for recording). */
export function nameForKeycode(code: number): string {
  return codeToName[code] ?? `key${code}`
}

/**
 * uiohook keycode for a logical key name (used for hold detection).
 * Tries a few sensible variants so "f6", "space", "a", "1" all resolve.
 */
export function keycodeForName(name: string): number | null {
  const lower = name.trim().toLowerCase()
  const variants = [
    name,
    lower,
    lower.toUpperCase(),
    cap(lower),
    `Num${lower.replace(/^num/, '')}`,
    arrowVariant(lower)
  ].filter(Boolean) as string[]

  for (const v of variants) {
    const code = (UiohookKey as Record<string, number>)[v]
    if (typeof code === 'number') return code
  }
  return null
}

function cap(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s
}

function arrowVariant(lower: string): string | null {
  const arrows: Record<string, string> = {
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight'
  }
  return arrows[lower] ?? null
}

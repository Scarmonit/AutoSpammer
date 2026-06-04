import { Key } from '@nut-tree-fork/nut-js'
import { UiohookKey } from 'uiohook-napi'

// ---------------------------------------------------------------------------
// Simulation side (nut-js): logical key name -> nut-js Key enum member.
// Single printable characters not listed here are typed literally.
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
  shiftright: 'RightShift',
  ctrl: 'LeftControl',
  ctrlright: 'RightControl',
  control: 'LeftControl',
  controlright: 'RightControl',
  alt: 'LeftAlt',
  altright: 'RightAlt',
  meta: 'LeftSuper',
  metaleft: 'LeftSuper',
  metaright: 'RightSuper',
  win: 'LeftSuper',
  capslock: 'CapsLock',
  ...buildFunctionKeys()
}

function buildFunctionKeys(): Record<string, keyof typeof Key> {
  const out: Record<string, keyof typeof Key> = {}
  for (let i = 1; i <= 24; i++) {
    const member = `F${i}` as keyof typeof Key
    if (member in Key) out[`f${i}`] = member
  }
  return out
}

// ---------------------------------------------------------------------------
// Punctuation + numpad: logical name -> nut-js Key name + uiohook key name.
// Their names differ between the two libraries, so this is the single source
// of truth that keeps simulation, hold detection, and recording consistent.
// Logical names are the literal characters (e.g. "-", "=") and "numpadN".
// ---------------------------------------------------------------------------
const EXTRA_KEYS: Record<string, { nut: string; uio: string }> = {
  '-': { nut: 'Minus', uio: 'Minus' },
  '=': { nut: 'Equal', uio: 'Equal' },
  '[': { nut: 'LeftBracket', uio: 'BracketLeft' },
  ']': { nut: 'RightBracket', uio: 'BracketRight' },
  '\\': { nut: 'Backslash', uio: 'Backslash' },
  ';': { nut: 'Semicolon', uio: 'Semicolon' },
  "'": { nut: 'Quote', uio: 'Quote' },
  '`': { nut: 'Grave', uio: 'Backquote' },
  ',': { nut: 'Comma', uio: 'Comma' },
  '.': { nut: 'Period', uio: 'Period' },
  '/': { nut: 'Slash', uio: 'Slash' },
  numpad0: { nut: 'NumPad0', uio: 'Numpad0' },
  numpad1: { nut: 'NumPad1', uio: 'Numpad1' },
  numpad2: { nut: 'NumPad2', uio: 'Numpad2' },
  numpad3: { nut: 'NumPad3', uio: 'Numpad3' },
  numpad4: { nut: 'NumPad4', uio: 'Numpad4' },
  numpad5: { nut: 'NumPad5', uio: 'Numpad5' },
  numpad6: { nut: 'NumPad6', uio: 'Numpad6' },
  numpad7: { nut: 'NumPad7', uio: 'Numpad7' },
  numpad8: { nut: 'NumPad8', uio: 'Numpad8' },
  numpad9: { nut: 'NumPad9', uio: 'Numpad9' },
  numpadadd: { nut: 'Add', uio: 'NumpadAdd' },
  numpadsubtract: { nut: 'Subtract', uio: 'NumpadSubtract' },
  numpadmultiply: { nut: 'Multiply', uio: 'NumpadMultiply' },
  numpaddivide: { nut: 'Divide', uio: 'NumpadDivide' },
  numpaddecimal: { nut: 'Decimal', uio: 'NumpadDecimal' }
}

const KEY_TABLE = Key as unknown as Record<string, number>
const UIO_TABLE = UiohookKey as unknown as Record<string, number>

function extraFor(name: string): { nut: string; uio: string } | undefined {
  const raw = name.trim()
  return EXTRA_KEYS[raw] ?? EXTRA_KEYS[raw.toLowerCase()]
}

/** Resolve a logical key name to a nut-js Key, or null to type it literally. */
export function nutKeyFor(name: string): Key | null {
  const lower = name.trim().toLowerCase()
  const special = NUT_SPECIAL[lower]
  if (special && special in Key) return Key[special] as unknown as Key
  const extra = extraFor(name)
  if (extra && extra.nut in KEY_TABLE) return KEY_TABLE[extra.nut] as unknown as Key
  return null
}

/**
 * Resolve a key name to a nut-js Key for press-and-HOLD use, where literal
 * typing isn't an option. Covers specials, letters, digits, punctuation, and
 * numpad keys; returns null only for keys nut-js can't hold.
 */
export function nutHoldKey(name: string): Key | null {
  const lower = name.trim().toLowerCase()
  const special = NUT_SPECIAL[lower]
  if (special && special in Key) return Key[special] as unknown as Key
  if (/^[a-z]$/.test(lower) && lower.toUpperCase() in KEY_TABLE) {
    return KEY_TABLE[lower.toUpperCase()] as unknown as Key
  }
  if (/^[0-9]$/.test(lower) && `Num${lower}` in KEY_TABLE) {
    return KEY_TABLE[`Num${lower}`] as unknown as Key
  }
  const extra = extraFor(name)
  if (extra && extra.nut in KEY_TABLE) return KEY_TABLE[extra.nut] as unknown as Key
  return null
}

// ---------------------------------------------------------------------------
// Listening side (uiohook): keycode <-> logical name.
// ---------------------------------------------------------------------------
const codeToName: Record<number, string> = (() => {
  const map: Record<number, string> = {}
  for (const [rawName, code] of Object.entries(UiohookKey)) {
    if (typeof code === 'number') map[code] = normalizeUiohookName(rawName)
  }
  // Overlay our canonical logical names so punctuation/numpad codes always map
  // back to the exact names EXTRA_KEYS understands (regardless of iteration).
  for (const [logical, { uio }] of Object.entries(EXTRA_KEYS)) {
    const code = UIO_TABLE[uio]
    if (typeof code === 'number') map[code] = logical
  }
  return map
})()

function normalizeUiohookName(raw: string): string {
  if (/^[A-Z]$/.test(raw)) return raw.toLowerCase() // letters
  if (/^[0-9]$/.test(raw)) return raw // number row
  const lower = raw.toLowerCase()
  const aliases: Record<string, string> = {
    arrowup: 'up',
    arrowdown: 'down',
    arrowleft: 'left',
    arrowright: 'right'
  }
  return aliases[lower] ?? lower
}

/** Friendly logical name for a uiohook keycode (used for recording). */
export function nameForKeycode(code: number): string {
  return codeToName[code] ?? `key${code}`
}

/**
 * uiohook keycode for a logical key name (used for hold detection).
 * Handles letters, digits, function keys, named keys, punctuation, and numpad.
 */
export function keycodeForName(name: string): number | null {
  const extra = extraFor(name)
  if (extra && typeof UIO_TABLE[extra.uio] === 'number') return UIO_TABLE[extra.uio]

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
    if (typeof UIO_TABLE[v] === 'number') return UIO_TABLE[v]
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

// ---------------------------------------------------------------------------
// Mouse buttons. Logical names (mouse-left/right/middle/4/5) <-> uiohook button
// numbers (left=1, right=2, middle=3, back=4, forward=5).
// ---------------------------------------------------------------------------
const MOUSE_BUTTON_NUMBERS: Record<string, number> = {
  'mouse-left': 1,
  'mouse-right': 2,
  'mouse-middle': 3,
  'mouse-4': 4,
  'mouse-5': 5
}

/** uiohook button number for a logical mouse-button name, or null if not one. */
export function mouseButtonNumber(name: string): number | null {
  return MOUSE_BUTTON_NUMBERS[name] ?? null
}

// ---------------------------------------------------------------------------
// Electron-accelerator parsing (used to detect the macro record hotkey from raw
// uiohook events, so the hotkey itself can be excluded from the recording).
// ---------------------------------------------------------------------------
export interface ParsedAccelerator {
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
  /** uiohook keycode of the base (non-modifier) key. */
  code: number
}

/** Map an accelerator's base token (e.g. "F10", "A", "num5", "Space") to a logical name. */
function accelBaseToName(tok: string): string {
  if (/^[A-Za-z]$/.test(tok)) return tok.toLowerCase()
  if (/^[0-9]$/.test(tok)) return tok
  if (/^f[0-9]{1,2}$/i.test(tok)) return tok.toLowerCase()
  const rev: Record<string, string> = {
    Space: 'space',
    Return: 'enter',
    Tab: 'tab',
    Escape: 'escape',
    Backspace: 'backspace',
    Delete: 'delete',
    Insert: 'insert',
    Home: 'home',
    End: 'end',
    PageUp: 'pageup',
    PageDown: 'pagedown',
    Up: 'up',
    Down: 'down',
    Left: 'left',
    Right: 'right',
    num0: 'numpad0',
    num1: 'numpad1',
    num2: 'numpad2',
    num3: 'numpad3',
    num4: 'numpad4',
    num5: 'numpad5',
    num6: 'numpad6',
    num7: 'numpad7',
    num8: 'numpad8',
    num9: 'numpad9',
    numadd: 'numpadadd',
    numsub: 'numpadsubtract',
    nummult: 'numpadmultiply',
    numdiv: 'numpaddivide',
    numdec: 'numpaddecimal'
  }
  return rev[tok] ?? tok
}

/** Parse an Electron accelerator into modifier flags + base uiohook keycode. */
export function parseAccelerator(accel: string): ParsedAccelerator | null {
  if (!accel) return null
  const parts = accel
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return null

  const base = parts[parts.length - 1]
  const mods = parts.slice(0, -1).map((m) => m.toLowerCase())
  const code = keycodeForName(accelBaseToName(base))
  if (code === null) return null

  return {
    ctrl: mods.some((m) => ['control', 'ctrl', 'commandorcontrol', 'cmdorctrl', 'command', 'cmd'].includes(m)),
    alt: mods.some((m) => ['alt', 'option'].includes(m)),
    shift: mods.includes('shift'),
    meta: mods.some((m) => ['super', 'meta', 'win'].includes(m)),
    code
  }
}

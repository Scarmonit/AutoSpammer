// Translates a browser KeyboardEvent into the two string formats the app uses:
//  - "name"        : logical key name for spam entries / hold keys ("a", "space", "-", "numpad0")
//  - "accelerator" : Electron global-shortcut accelerator ("F6", "Control+Shift+K")

const CODE_NAME: Record<string, string> = {
  Space: 'space',
  Enter: 'enter',
  NumpadEnter: 'enter',
  Tab: 'tab',
  Escape: 'escape',
  Backspace: 'backspace',
  Delete: 'delete',
  Insert: 'insert',
  Home: 'home',
  End: 'end',
  PageUp: 'pageup',
  PageDown: 'pagedown',
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  CapsLock: 'capslock',
  // Punctuation row (logical name = the literal character)
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Comma: ',',
  Period: '.',
  Slash: '/',
  // Numpad operators
  NumpadAdd: 'numpadadd',
  NumpadSubtract: 'numpadsubtract',
  NumpadMultiply: 'numpadmultiply',
  NumpadDivide: 'numpaddivide',
  NumpadDecimal: 'numpaddecimal',
  // Modifiers (usable as hold/trigger keys)
  ShiftLeft: 'shift',
  ShiftRight: 'shift',
  ControlLeft: 'ctrl',
  ControlRight: 'ctrl',
  AltLeft: 'alt',
  AltRight: 'alt'
}

function baseName(e: KeyboardEvent): string | null {
  const code = e.code
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase()
  if (/^Digit[0-9]$/.test(code)) return code.slice(5)
  if (/^Numpad[0-9]$/.test(code)) return 'numpad' + code.slice(6)
  if (/^F[0-9]{1,2}$/.test(code)) return code.toLowerCase() // f1..f24
  return CODE_NAME[code] ?? null
}

/** Logical key name for spam entries and hold keys. */
export function toName(e: KeyboardEvent): string | null {
  return baseName(e)
}

// logical name -> Electron accelerator token (only where it differs from the
// literal name; punctuation passes through as the literal character).
const ACCEL_NAME: Record<string, string> = {
  space: 'Space',
  enter: 'Return',
  tab: 'Tab',
  escape: 'Escape',
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
  numpad0: 'num0',
  numpad1: 'num1',
  numpad2: 'num2',
  numpad3: 'num3',
  numpad4: 'num4',
  numpad5: 'num5',
  numpad6: 'num6',
  numpad7: 'num7',
  numpad8: 'num8',
  numpad9: 'num9',
  numpadadd: 'numadd',
  numpadsubtract: 'numsub',
  numpadmultiply: 'nummult',
  numpaddivide: 'numdiv',
  numpaddecimal: 'numdec'
}

/** Electron accelerator string, including any held modifiers. */
export function toAccelerator(e: KeyboardEvent): string | null {
  const base = baseName(e)
  if (!base || base === 'shift' || base === 'ctrl' || base === 'alt') return null // need a real key

  let main: string
  if (/^[a-z]$/.test(base)) main = base.toUpperCase()
  else if (/^[0-9]$/.test(base)) main = base
  else if (/^f[0-9]{1,2}$/.test(base)) main = base.toUpperCase()
  else main = ACCEL_NAME[base] ?? base // punctuation passes through literally

  const mods: string[] = []
  if (e.ctrlKey) mods.push('Control')
  if (e.altKey) mods.push('Alt')
  if (e.shiftKey) mods.push('Shift')
  if (e.metaKey) mods.push('Super')

  return [...mods, main].join('+')
}

/**
 * Logical mouse-button name for a browser MouseEvent, or null for buttons we
 * don't support. Mirrors the names the main process matches against:
 *   0 → mouse-left, 1 → mouse-middle, 2 → mouse-right, 3 → mouse-4, 4 → mouse-5
 */
export function toMouseName(e: MouseEvent): string | null {
  switch (e.button) {
    case 0:
      return 'mouse-left'
    case 1:
      return 'mouse-middle'
    case 2:
      return 'mouse-right'
    case 3:
      return 'mouse-4'
    case 4:
      return 'mouse-5'
    default:
      return null
  }
}

const MOUSE_LABELS: Record<string, string> = {
  'mouse-left': 'Left Click',
  'mouse-right': 'Right Click',
  'mouse-middle': 'MMB',
  'mouse-4': 'MB4',
  'mouse-5': 'MB5'
}

/** Human-friendly label for an entry/hold key or mouse-button name. */
export function prettyName(name: string): string {
  if (!name) return '—'
  if (name in MOUSE_LABELS) return MOUSE_LABELS[name]
  if (name.startsWith('numpad')) return 'Numpad ' + name.slice(6)
  if (name.length === 1) return name.toUpperCase()
  return name.charAt(0).toUpperCase() + name.slice(1)
}

// Translates a browser KeyboardEvent into the two string formats the app uses:
//  - "name"        : logical key name for spam entries / hold keys ("a", "space", "f6")
//  - "accelerator" : Electron global-shortcut accelerator ("F6", "Control+Shift+K")

function baseName(e: KeyboardEvent): string | null {
  const code = e.code
  if (/^Key([A-Z])$/.test(code)) return code.slice(3).toLowerCase()
  if (/^Digit([0-9])$/.test(code)) return code.slice(5)
  if (/^F([0-9]{1,2})$/.test(code)) return code.toLowerCase() // f1..f24
  const map: Record<string, string> = {
    Space: 'space',
    Enter: 'enter',
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
    ArrowRight: 'right'
  }
  return map[code] ?? null
}

/** Logical key name for spam entries and hold keys. Modifiers alone are rejected. */
export function toName(e: KeyboardEvent): string | null {
  return baseName(e)
}

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
  right: 'Right'
}

/** Electron accelerator string, including any held modifiers. */
export function toAccelerator(e: KeyboardEvent): string | null {
  const base = baseName(e)
  if (!base) return null

  let main: string
  if (/^[a-z]$/.test(base)) main = base.toUpperCase()
  else if (/^[0-9]$/.test(base)) main = base
  else if (/^f[0-9]{1,2}$/.test(base)) main = base.toUpperCase()
  else main = ACCEL_NAME[base] ?? base

  const mods: string[] = []
  if (e.ctrlKey) mods.push('Control')
  if (e.altKey) mods.push('Alt')
  if (e.shiftKey) mods.push('Shift')
  if (e.metaKey) mods.push('Super')

  return [...mods, main].join('+')
}

/** Human-friendly label for an entry/hold key name. */
export function prettyName(name: string): string {
  if (!name) return '—'
  if (name === 'mouse-left') return 'Left Click'
  if (name === 'mouse-right') return 'Right Click'
  if (name.length === 1) return name.toUpperCase()
  return name.charAt(0).toUpperCase() + name.slice(1)
}

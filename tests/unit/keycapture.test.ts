import { describe, it, expect } from 'vitest'
import { toName, toAccelerator, prettyName } from '../../src/renderer/src/keycapture'

// keycapture only reads `.code` / modifier flags, so a plain object suffices.
const ev = (code: string, mods: Partial<KeyboardEvent> = {}): KeyboardEvent =>
  ({ code, ...mods }) as KeyboardEvent

describe('keycapture — toName (Set Key)', () => {
  it('captures letters, digits, and named keys', () => {
    expect(toName(ev('KeyA'))).toBe('a')
    expect(toName(ev('Digit3'))).toBe('3')
    expect(toName(ev('Space'))).toBe('space')
    expect(toName(ev('F6'))).toBe('f6')
  })

  it('captures punctuation — the reported "-" / "=" case', () => {
    expect(toName(ev('Minus'))).toBe('-')
    expect(toName(ev('Equal'))).toBe('=')
    expect(toName(ev('Slash'))).toBe('/')
    expect(toName(ev('Semicolon'))).toBe(';')
    expect(toName(ev('BracketLeft'))).toBe('[')
  })

  it('captures numpad and modifier keys', () => {
    expect(toName(ev('Numpad5'))).toBe('numpad5')
    expect(toName(ev('NumpadAdd'))).toBe('numpadadd')
    expect(toName(ev('ShiftLeft'))).toBe('shift')
  })
})

describe('keycapture — toAccelerator (hotkeys)', () => {
  it('builds accelerators including punctuation and modifiers', () => {
    expect(toAccelerator(ev('F6'))).toBe('F6')
    expect(toAccelerator(ev('Minus'))).toBe('-')
    expect(toAccelerator(ev('Equal'))).toBe('=')
    expect(toAccelerator(ev('KeyK', { ctrlKey: true, shiftKey: true }))).toBe('Control+Shift+K')
  })

  it('rejects a lone modifier as an accelerator', () => {
    expect(toAccelerator(ev('ShiftLeft'))).toBeNull()
  })
})

describe('keycapture — prettyName', () => {
  it('labels keys readably', () => {
    expect(prettyName('-')).toBe('-')
    expect(prettyName('a')).toBe('A')
    expect(prettyName('numpad5')).toBe('Numpad 5')
    expect(prettyName('mouse-left')).toBe('Left Click')
    expect(prettyName('mouse-right')).toBe('Right Click')
    expect(prettyName('mouse-4')).toBe('MB4')
    expect(prettyName('mouse-5')).toBe('MB5')
  })
})

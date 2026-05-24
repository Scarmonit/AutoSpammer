import { describe, it, expect } from 'vitest'
import { nutKeyFor, nutHoldKey, keycodeForName, nameForKeycode } from '../../src/main/keymap'
import { Key } from '@nut-tree-fork/nut-js'
import { UiohookKey } from 'uiohook-napi'

describe('keymap — simulation (nut-js)', () => {
  it('maps special key names to nut-js Key', () => {
    expect(nutKeyFor('space')).toBe(Key.Space)
    expect(nutKeyFor('enter')).toBe(Key.Return)
    expect(nutKeyFor('f6')).toBe(Key.F6)
  })

  it('returns null for printable single chars (typed literally)', () => {
    expect(nutKeyFor('a')).toBeNull()
    expect(nutKeyFor('1')).toBeNull()
  })

  it('nutHoldKey resolves letters, digits, and specials for holding', () => {
    expect(nutHoldKey('w')).toBe(Key.W)
    expect(nutHoldKey('1')).toBe(Key.Num1)
    expect(nutHoldKey('space')).toBe(Key.Space)
    expect(nutHoldKey('shift')).toBe(Key.LeftShift)
  })

  it('maps punctuation keys (the reported "-" / "=" case) and numpad', () => {
    expect(nutKeyFor('-')).toBe(Key.Minus)
    expect(nutKeyFor('=')).toBe(Key.Equal)
    expect(nutKeyFor('/')).toBe(Key.Slash)
    expect(nutHoldKey('-')).toBe(Key.Minus)
    expect(nutHoldKey('=')).toBe(Key.Equal)
    expect(nutKeyFor('numpad5')).toBe(Key.NumPad5)
  })
})

describe('keymap — listening (uiohook)', () => {
  it('keycodeForName resolves common keys to uiohook codes', () => {
    expect(keycodeForName('f6')).toBe(UiohookKey.F6)
    expect(keycodeForName('space')).toBe(UiohookKey.Space)
    expect(keycodeForName('a')).toBe(UiohookKey.A)
    expect(keycodeForName('1')).toBe(UiohookKey['1'])
  })

  it('round-trips keycode -> name -> keycode for letters and digits', () => {
    for (const name of ['a', 'w', 'z', '1', '5']) {
      const code = keycodeForName(name)
      expect(code).not.toBeNull()
      expect(nameForKeycode(code as number)).toBe(name)
    }
  })

  it('maps the space keycode back to "space"', () => {
    expect(nameForKeycode(UiohookKey.Space)).toBe('space')
  })

  it('resolves and round-trips punctuation for hold detection', () => {
    expect(keycodeForName('-')).toBe(UiohookKey.Minus)
    expect(keycodeForName('=')).toBe(UiohookKey.Equal)
    expect(nameForKeycode(UiohookKey.Minus)).toBe('-')
    expect(nameForKeycode(UiohookKey.Equal)).toBe('=')
    for (const ch of ['-', '=', '[', ']', ';', "'", ',', '.', '/']) {
      const code = keycodeForName(ch)
      expect(code).not.toBeNull()
      expect(nameForKeycode(code as number)).toBe(ch)
    }
  })
})

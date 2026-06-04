import { describe, it, expect } from 'vitest'
import { createDefaultProfile, createDefaultSettings } from '@shared/defaults'
import {
  canonicalBinding,
  collectBindings,
  findBindingConflict,
  conflictMessage
} from '@shared/bindings'

describe('canonicalBinding', () => {
  it('treats an accelerator and a logical key for the same physical key as equal', () => {
    expect(canonicalBinding('F6')).toBe(canonicalBinding('f6'))
    expect(canonicalBinding('Space')).toBe(canonicalBinding('space'))
    expect(canonicalBinding('A')).toBe(canonicalBinding('a'))
    expect(canonicalBinding('num5')).toBe(canonicalBinding('numpad5'))
  })

  it('distinguishes modified combos from the bare key', () => {
    expect(canonicalBinding('Control+F6')).not.toBe(canonicalBinding('F6'))
    expect(canonicalBinding('Control+Shift+K')).toBe(canonicalBinding('Shift+Control+K')) // order-independent
  })

  it('maps mouse buttons and treats empty as no binding', () => {
    expect(canonicalBinding('mouse-left')).toBe('mouse:left')
    expect(canonicalBinding('mouse-right')).toBe('mouse:right')
    expect(canonicalBinding('mouse-middle')).toBe('mouse:middle')
    expect(canonicalBinding('mouse-4')).toBe('mouse:4')
    expect(canonicalBinding('mouse-5')).toBe('mouse:5')
    expect(canonicalBinding('')).toBeNull()
  })

  it('detects conflicts between two mouse-button bindings', () => {
    const settings = createDefaultSettings('p1')
    const profile = createDefaultProfile('test')
    profile.focusHold = { enabled: true, key: 'mouse-4', delayMs: 10 }
    const c = findBindingConflict(collectBindings(settings, profile), 'holdToSpam', 'mouse-4')
    expect(c?.feature).toBe('Focus Hold Key')
  })
})

describe('findBindingConflict', () => {
  const settings = createDefaultSettings('p1')
  const profile = createDefaultProfile('test')
  profile.focusHold = { enabled: true, key: 'f', delayMs: 10 }
  const bindings = collectBindings(settings, profile)

  it('flags binding a hold key already used by another hold trigger', () => {
    const c = findBindingConflict(bindings, 'rightClickHold', 'f')
    expect(c).not.toBeNull()
    expect(c?.feature).toBe('Focus Hold Key')
  })

  it('flags a mouse button already bound elsewhere', () => {
    const p2 = createDefaultProfile('t2')
    p2.holdToSpam = { enabled: true, key: 'mouse-left', delayMs: 10 }
    const c = findBindingConflict(collectBindings(settings, p2), 'rightClickHold', 'mouse-left')
    expect(c?.feature).toBe('Hold-to-Spam Key')
  })

  it('flags an accelerator already used by another hotkey (default F6 toggle)', () => {
    // Emergency defaults to Escape; trying to set it to F6 hits the toggle hotkey.
    const c = findBindingConflict(bindings, 'emergencyHotkey', 'F6')
    expect(c?.feature).toBe('Toggle Hotkey')
  })

  it('allows re-assigning a field to the value it already has', () => {
    expect(findBindingConflict(bindings, 'focusHold', 'f')).toBeNull()
  })

  it('allows a free key and an empty value', () => {
    expect(findBindingConflict(bindings, 'rightClickHold', 'g')).toBeNull()
    expect(findBindingConflict(bindings, 'rightClickHold', '')).toBeNull()
  })
})

describe('conflictMessage', () => {
  it('matches the required format for keys', () => {
    expect(conflictMessage('f', 'Focus Hold Key')).toBe(
      'The key F is already bound to Focus Hold Key'
    )
  })

  it('adapts the wording for mouse buttons', () => {
    expect(conflictMessage('mouse-left', 'Hold-to-Spam Key')).toBe(
      'LMB is already bound to Hold-to-Spam Key'
    )
    expect(conflictMessage('mouse-4', 'Focus Hold Key')).toBe(
      'MB4 is already bound to Focus Hold Key'
    )
  })
})

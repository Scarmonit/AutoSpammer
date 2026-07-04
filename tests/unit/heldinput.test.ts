import { describe, it, expect, vi, beforeEach } from 'vitest'

// Record the exact order of nut-js mouse/keyboard calls so we can prove a held
// click/press keeps the button DOWN across the hold before releasing (the fix
// for games that poll input state per frame and miss an instantaneous click).
const calls: string[] = []
vi.mock('@nut-tree-fork/nut-js', () => {
  const mkButton = { LEFT: 'LEFT', RIGHT: 'RIGHT', MIDDLE: 'MIDDLE' }
  return {
    keyboard: {
      config: {},
      pressKey: vi.fn((k: unknown) => { calls.push(`keyDown:${String(k)}`); return Promise.resolve() }),
      releaseKey: vi.fn((k: unknown) => { calls.push(`keyUp:${String(k)}`); return Promise.resolve() }),
      type: vi.fn(() => { calls.push('type'); return Promise.resolve() })
    },
    mouse: {
      config: {},
      pressButton: vi.fn((b: unknown) => { calls.push(`down:${String(b)}`); return Promise.resolve() }),
      releaseButton: vi.fn((b: unknown) => { calls.push(`up:${String(b)}`); return Promise.resolve() }),
      click: vi.fn(() => { calls.push('click'); return Promise.resolve() }),
      setPosition: vi.fn(() => { calls.push('move'); return Promise.resolve() }),
      getPosition: vi.fn(() => Promise.resolve({ x: 0, y: 0 }))
    },
    Button: mkButton,
    Point: class { constructor(public x: number, public y: number) {} }
  }
})

// nutHoldKey returns a holdable key for letters; keycodeForName gives any code.
vi.mock('../../src/main/keymap', () => ({
  nutKeyFor: () => null,
  nutHoldKey: (name: string) => (name === 'a' ? 'KEY_A' : null),
  keycodeForName: () => 30
}))

import { tapBindingHeld, clickAtHeld } from '../../src/main/input'

beforeEach(() => { calls.length = 0 })

describe('held input (state-poll-safe clicks/presses)', () => {
  it('holds a left click down for the hold duration, then releases', async () => {
    await tapBindingHeld('mouse-left', 40)
    expect(calls).toEqual(['down:LEFT', 'up:LEFT'])
    // Crucially it uses press/release (a real hold), not an instantaneous click.
    expect(calls).not.toContain('click')
  })

  it('holds a key down then releases it (not an instant type)', async () => {
    await tapBindingHeld('a', 40)
    expect(calls).toEqual(['keyDown:KEY_A', 'keyUp:KEY_A'])
    expect(calls).not.toContain('type')
  })

  it('moves then holds a position click', async () => {
    await clickAtHeld(100, 200, 'left', 40)
    expect(calls).toEqual(['move', 'down:LEFT', 'up:LEFT'])
  })

  it('falls back to an instantaneous click/type when holdMs <= 0', async () => {
    await tapBindingHeld('mouse-left', 0)
    expect(calls).toEqual(['click']) // nut-js click(), the fast path
    calls.length = 0
    await clickAtHeld(1, 2, 'right', 0)
    expect(calls).toEqual(['move', 'click'])
  })

  it('right/middle held clicks use the matching button', async () => {
    await tapBindingHeld('mouse-right', 30)
    expect(calls).toEqual(['down:RIGHT', 'up:RIGHT'])
  })
})

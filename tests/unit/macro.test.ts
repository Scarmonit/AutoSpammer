import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MacroEvent } from '@shared/types'

// Keep the recorder/player off the native input layer.
vi.mock('../../src/main/input', () => ({
  keyDownName: vi.fn(() => Promise.resolve()),
  keyUpName: vi.fn(() => Promise.resolve()),
  mouseMove: vi.fn(() => Promise.resolve()),
  mouseButtonDown: vi.fn(() => Promise.resolve()),
  mouseButtonUp: vi.fn(() => Promise.resolve())
}))

import { MacroRecorder, MacroPlayer } from '../../src/main/macro'
import * as input from '../../src/main/input'

let now = 0
beforeEach(() => {
  now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  vi.clearAllMocks()
})
afterEach(() => vi.restoreAllMocks())

const advance = (ms: number): void => {
  now += ms
}

describe('MacroRecorder', () => {
  it('records delays relative to the previous event (first is 0)', () => {
    const r = new MacroRecorder()
    r.start()
    r.keyDown('a')
    advance(250)
    r.keyUp('a')
    advance(1000)
    r.keyDown('b')
    const events = r.stop()
    expect(events.map((e) => [e.type, e.key, e.delayMs])).toEqual([
      ['key-down', 'a', 0],
      ['key-up', 'a', 250],
      ['key-down', 'b', 1000],
      // 'b' was still held at stop -> auto-released so playback stays balanced.
      ['key-up', 'b', 0]
    ])
  })

  it('ignores keyboard auto-repeat (a held key only records one down)', () => {
    const r = new MacroRecorder()
    r.start()
    r.keyDown('w')
    advance(30)
    r.keyDown('w') // OS auto-repeat
    advance(30)
    r.keyDown('w') // OS auto-repeat
    r.keyUp('w')
    const events = r.stop()
    expect(events.filter((e) => e.type === 'key-down')).toHaveLength(1)
    expect(events.filter((e) => e.type === 'key-up')).toHaveLength(1)
  })

  it('drops the stop-hotkey modifier that was only held to trigger the stop', () => {
    const r = new MacroRecorder()
    r.start()
    r.keyDown('a')
    advance(100)
    r.keyUp('a')
    advance(100)
    r.keyDown('ctrl') // held purely to fire a "Ctrl+F10"-style stop hotkey
    const events = r.stop({ ctrl: true, alt: false, shift: false, meta: false })
    // The dangling ctrl-down is removed; only the real a-down/up survive.
    expect(events.map((e) => e.type)).toEqual(['key-down', 'key-up'])
    expect(events.some((e) => e.key === 'ctrl')).toBe(false)
  })

  it('releases a still-held mouse button on stop', () => {
    const r = new MacroRecorder()
    r.start()
    r.mouseDown('left', 5, 6)
    const events = r.stop()
    expect(events.map((e) => e.type)).toEqual(['mouse-down', 'mouse-up'])
    expect(events[1]).toMatchObject({ button: 'left', x: 5, y: 6 })
  })
})

describe('MacroPlayer', () => {
  const player = (): { p: MacroPlayer; stopped: () => boolean } => {
    let stopped = false
    const p = new MacroPlayer({
      onStart: () => {},
      onStop: () => (stopped = true),
      onError: () => {}
    })
    return { p, stopped: () => stopped }
  }

  it('replays events in order, moving before mouse presses', async () => {
    const events: MacroEvent[] = [
      { id: '1', type: 'key-down', delayMs: 0, key: 'a' },
      { id: '2', type: 'key-up', delayMs: 0, key: 'a' },
      { id: '3', type: 'mouse-down', delayMs: 0, button: 'right', x: 30, y: 40 },
      { id: '4', type: 'mouse-up', delayMs: 0, button: 'right', x: 30, y: 40 }
    ]
    const { p, stopped } = player()
    await p.play(events)

    expect(vi.mocked(input.keyDownName)).toHaveBeenCalledWith('a')
    expect(vi.mocked(input.keyUpName)).toHaveBeenCalledWith('a')
    expect(vi.mocked(input.mouseMove)).toHaveBeenCalledWith(30, 40)
    expect(vi.mocked(input.mouseButtonDown)).toHaveBeenCalledWith('right')
    expect(vi.mocked(input.mouseButtonUp)).toHaveBeenCalledWith('right')
    expect(stopped()).toBe(true)
    expect(p.isPlaying()).toBe(false)
  })

  it('reports an error for an empty macro', async () => {
    let err = ''
    const p = new MacroPlayer({ onStart: () => {}, onStop: () => {}, onError: (m) => (err = m) })
    await p.play([])
    expect(err).toMatch(/empty/i)
    expect(input.keyDownName).not.toHaveBeenCalled()
  })
})

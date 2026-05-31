import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Profile, SpamMode } from '@shared/types'
import { createDefaultProfile } from '@shared/defaults'

// Isolate the engine from the native input layer: assert which actions fire,
// in what order, without touching the OS.
vi.mock('../../src/main/input', () => ({
  pressKey: vi.fn(() => Promise.resolve()),
  typeText: vi.fn(() => Promise.resolve()),
  clickMouse: vi.fn(() => Promise.resolve()),
  clickAt: vi.fn(() => Promise.resolve()),
  clearSynthetic: vi.fn(),
  // Macro playback primitives (used via ./macro -> playMacroEvent).
  keyDownName: vi.fn(() => Promise.resolve()),
  keyUpName: vi.fn(() => Promise.resolve()),
  mouseMove: vi.fn(() => Promise.resolve()),
  mouseButtonDown: vi.fn(() => Promise.resolve()),
  mouseButtonUp: vi.fn(() => Promise.resolve())
}))

import { SpamEngine } from '../../src/main/engine'
import * as input from '../../src/main/input'

const pressKey = vi.mocked(input.pressKey)
const typeText = vi.mocked(input.typeText)
const clickMouse = vi.mocked(input.clickMouse)
const clickAt = vi.mocked(input.clickAt)

beforeEach(() => vi.clearAllMocks())

/** Build a minimal, fast (zero-delay) profile. */
function profile(mut: (p: Profile) => void): Profile {
  const p = createDefaultProfile('test')
  p.entries = []
  p.clickPositions = []
  p.options = {
    ...p.options,
    spacebar: false,
    leftClick: false,
    rightClick: false,
    defaultDelayMs: 0,
    enableKeys: true,
    enableClickPositions: true
  }
  p.textFunction = { enabled: false, text: '', delayMs: 0 }
  p.loop = { mode: 'once', count: 1 }
  mut(p)
  return p
}

function key(k: string, delayMs: number | null = null) {
  return { id: k, kind: 'key' as const, key: k, delayMs }
}

/** Run the engine and resolve once it returns to idle (for finite loops). */
function runToIdle(p: Profile, mode: SpamMode = 'manual'): Promise<{ errors: string[]; engine: SpamEngine }> {
  return new Promise((resolve) => {
    const errors: string[] = []
    let running = false
    const engine = new SpamEngine({
      onStatus: (s) => {
        if (s.status === 'running') running = true
        else if (running && s.status === 'idle') resolve({ errors, engine })
      },
      onError: (m) => errors.push(m)
    })
    engine.start(p, mode)
  })
}

const pressedKeys = (): string[] => pressKey.mock.calls.map((c) => c[0] as string)

describe('SpamEngine — loop modes', () => {
  it('fires all keys once in order for "play once"', async () => {
    const p = profile((p) => {
      p.entries = [key('space'), key('1')]
      p.loop = { mode: 'once', count: 1 }
    })
    const { engine } = await runToIdle(p)
    expect(pressedKeys()).toEqual(['space', '1'])
    expect(engine.getStatus().cyclesDone).toBe(1)
  })

  it('repeats N times for "loop count"', async () => {
    const p = profile((p) => {
      p.entries = [key('a')]
      p.loop = { mode: 'count', count: 3 }
    })
    const { engine } = await runToIdle(p)
    expect(pressedKeys()).toEqual(['a', 'a', 'a'])
    expect(engine.getStatus().cyclesDone).toBe(3)
  })
})

describe('SpamEngine — sequence mode', () => {
  it('fires one entry per iteration, counting full passes', async () => {
    const p = profile((p) => {
      p.entries = [key('a'), key('b')]
      p.options.sequenceMode = true
      p.loop = { mode: 'count', count: 2 }
    })
    const { engine } = await runToIdle(p)
    expect(pressedKeys()).toEqual(['a', 'b', 'a', 'b'])
    expect(engine.getStatus().cyclesDone).toBe(2)
  })
})

describe('SpamEngine — options, positions, text', () => {
  it('includes spacebar and mouse-click options', async () => {
    const p = profile((p) => {
      p.entries = [key('a')]
      p.options.spacebar = true
      p.options.leftClick = true
      p.loop = { mode: 'once', count: 1 }
    })
    await runToIdle(p)
    expect(pressedKeys()).toEqual(['a', 'space'])
    expect(clickMouse).toHaveBeenCalledWith('left')
  })

  it('clicks recorded positions', async () => {
    const p = profile((p) => {
      p.clickPositions = [{ id: 'p1', x: 100, y: 200, button: 'right', delayMs: null }]
      p.loop = { mode: 'once', count: 1 }
    })
    await runToIdle(p)
    expect(clickAt).toHaveBeenCalledWith(100, 200, 'right')
  })

  it('types the text function string each cycle', async () => {
    const p = profile((p) => {
      p.textFunction = { enabled: true, text: 'gg', delayMs: 0 }
      p.loop = { mode: 'once', count: 1 }
    })
    await runToIdle(p)
    expect(typeText).toHaveBeenCalledWith('gg')
  })

  it('reports an error when there is nothing to spam', () => {
    const errors: string[] = []
    const engine = new SpamEngine({ onStatus: () => {}, onError: (m) => errors.push(m) })
    engine.start(
      profile((p) => {
        p.entries = []
      }),
      'manual'
    )
    expect(errors.length).toBe(1)
    expect(pressKey).not.toHaveBeenCalled()
    expect(engine.isRunning()).toBe(false)
  })
})

describe('SpamEngine — enable/disable Keys vs Click Positions', () => {
  it('fires only click positions when Keys are disabled', async () => {
    const p = profile((p) => {
      p.entries = [key('a')]
      p.options.spacebar = true
      p.options.enableKeys = false
      p.clickPositions = [{ id: 'p1', x: 10, y: 20, button: 'left', delayMs: null }]
    })
    await runToIdle(p)
    expect(pressKey).not.toHaveBeenCalled()
    expect(clickMouse).not.toHaveBeenCalled()
    expect(clickAt).toHaveBeenCalledWith(10, 20, 'left')
  })

  it('fires only keys when Click Positions are disabled', async () => {
    const p = profile((p) => {
      p.entries = [key('a')]
      p.options.enableClickPositions = false
      p.clickPositions = [{ id: 'p1', x: 10, y: 20, button: 'left', delayMs: null }]
    })
    await runToIdle(p)
    expect(pressedKeys()).toEqual(['a'])
    expect(clickAt).not.toHaveBeenCalled()
  })

  it('fires both when both are enabled', async () => {
    const p = profile((p) => {
      p.entries = [key('a')]
      p.clickPositions = [{ id: 'p1', x: 10, y: 20, button: 'left', delayMs: null }]
    })
    await runToIdle(p)
    expect(pressedKeys()).toEqual(['a'])
    expect(clickAt).toHaveBeenCalledWith(10, 20, 'left')
  })

  it('does nothing and warns when both are disabled', () => {
    const errors: string[] = []
    const engine = new SpamEngine({ onStatus: () => {}, onError: (m) => errors.push(m) })
    engine.start(
      profile((p) => {
        p.entries = [key('a')]
        p.clickPositions = [{ id: 'p1', x: 10, y: 20, button: 'left', delayMs: null }]
        p.options.enableKeys = false
        p.options.enableClickPositions = false
      }),
      'manual'
    )
    expect(errors.length).toBe(1)
    expect(errors[0]).toMatch(/both/i)
    expect(pressKey).not.toHaveBeenCalled()
    expect(clickAt).not.toHaveBeenCalled()
    expect(engine.isRunning()).toBe(false)
  })
})

describe('SpamEngine — macro playback', () => {
  const keyDownName = vi.mocked(input.keyDownName)
  const keyUpName = vi.mocked(input.keyUpName)

  it('plays the macro events in order when enabled (loop once)', async () => {
    const p = profile((p) => {
      p.entries = [key('a')] // ignored: macro takes over a manual run
      p.macro = {
        enabled: true,
        events: [
          { id: '1', type: 'key-down', delayMs: 0, key: 'b' },
          { id: '2', type: 'key-up', delayMs: 0, key: 'b' }
        ]
      }
      p.loop = { mode: 'once', count: 1 }
    })
    const { engine } = await runToIdle(p)
    expect(pressKey).not.toHaveBeenCalled() // not the keys-to-spam path
    expect(keyDownName.mock.calls.map((c) => c[0])).toEqual(['b'])
    expect(keyUpName.mock.calls.map((c) => c[0])).toEqual(['b'])
    expect(engine.getStatus().cyclesDone).toBe(1)
  })

  it('loops the macro N times for "loop count"', async () => {
    const p = profile((p) => {
      p.macro = {
        enabled: true,
        events: [
          { id: '1', type: 'key-down', delayMs: 0, key: 'b' },
          { id: '2', type: 'key-up', delayMs: 0, key: 'b' }
        ]
      }
      p.loop = { mode: 'count', count: 3 }
    })
    const { engine } = await runToIdle(p)
    expect(keyDownName.mock.calls.length).toBe(3)
    expect(engine.getStatus().cyclesDone).toBe(3)
  })

  it('errors when the macro is enabled but empty', () => {
    const errors: string[] = []
    const engine = new SpamEngine({ onStatus: () => {}, onError: (m) => errors.push(m) })
    engine.start(
      profile((p) => {
        p.macro = { enabled: true, events: [] }
      }),
      'manual'
    )
    expect(errors.length).toBe(1)
    expect(errors[0]).toMatch(/macro/i)
    expect(engine.isRunning()).toBe(false)
  })

  it('releases a still-held key when stopped mid-press (no stuck keys)', async () => {
    const p = profile((p) => {
      p.macro = {
        enabled: true,
        events: [
          { id: '1', type: 'key-down', delayMs: 0, key: 'w' },
          { id: '2', type: 'key-up', delayMs: 5000, key: 'w' } // long gap we interrupt
        ]
      }
      p.loop = { mode: 'forever', count: 1 }
    })
    const engine = new SpamEngine({ onStatus: () => {}, onError: () => {} })
    engine.start(p, 'manual')
    await new Promise((r) => setTimeout(r, 30)) // let key-down fire, then it waits
    engine.stop()
    await new Promise((r) => setTimeout(r, 20))

    expect(keyDownName.mock.calls.map((c) => c[0])).toEqual(['w'])
    // The scheduled key-up never fired, but the cleanup released 'w'.
    expect(keyUpName.mock.calls.map((c) => c[0])).toEqual(['w'])
    expect(engine.isRunning()).toBe(false)
  })
})

describe('SpamEngine — right-click hold', () => {
  it('fires ONLY right-clicks, repeatedly, until stopped', async () => {
    const p = profile((p) => {
      p.entries = [key('x')] // ignored in right-click-hold mode
      p.rightClickHold = { enabled: true, key: 'mouse-left', delayMs: 5 }
    })
    const engine = new SpamEngine({ onStatus: () => {}, onError: () => {} })
    engine.start(p, 'right-click-hold')
    await new Promise((r) => setTimeout(r, 40))
    engine.stop()
    await new Promise((r) => setTimeout(r, 20))

    expect(clickMouse.mock.calls.length).toBeGreaterThan(1)
    expect(clickMouse.mock.calls.every((c) => c[0] === 'right')).toBe(true)
    expect(pressKey).not.toHaveBeenCalled()
    expect(engine.isRunning()).toBe(false)
  })
})

describe('SpamEngine — focus hold', () => {
  it('fires ONLY the focus key, repeatedly, until stopped', async () => {
    const p = profile((p) => {
      p.entries = [key('x')] // should be ignored in focus-hold mode
      p.focusHold = { enabled: true, key: 'f', delayMs: 5 }
    })
    const engine = new SpamEngine({ onStatus: () => {}, onError: () => {} })
    engine.start(p, 'focus-hold')
    await new Promise((r) => setTimeout(r, 40))
    engine.stop()
    await new Promise((r) => setTimeout(r, 20))

    const keys = pressedKeys()
    expect(keys.length).toBeGreaterThan(1)
    expect(keys.every((k) => k === 'f')).toBe(true)
    expect(engine.isRunning()).toBe(false)
  })
})

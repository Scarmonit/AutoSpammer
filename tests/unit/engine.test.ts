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
  mouseButtonUp: vi.fn(() => Promise.resolve()),
  // Hold Keys Down primitives.
  holdKeyDown: vi.fn(() => Promise.resolve(true)),
  releaseKey: vi.fn(() => Promise.resolve()),
  // Periodic press (taps a key or clicks a mouse button).
  tapBinding: vi.fn(() => Promise.resolve())
}))

// Isolate the engine from the screen-capture layer (detection.ts pulls in
// Electron + nut-js): a controllable runner records how it's driven.
const detectionRunners: FakeDetectionRunner[] = []
class FakeDetectionRunner {
  started = false
  stopped = false
  constructor(
    public config: unknown,
    public positions: unknown,
    public onError: (m: string) => void
  ) {
    detectionRunners.push(this)
  }
  hasWork(): boolean {
    return true
  }
  start(): void {
    this.started = true
  }
  stop(): void {
    this.stopped = true
  }
}
vi.mock('../../src/main/detection', () => ({
  DetectionRunner: vi.fn(
    (config: unknown, positions: unknown, onError: (m: string) => void) =>
      new FakeDetectionRunner(config, positions, onError)
  )
}))

import { SpamEngine } from '../../src/main/engine'
import * as input from '../../src/main/input'

const pressKey = vi.mocked(input.pressKey)
const typeText = vi.mocked(input.typeText)
const clickMouse = vi.mocked(input.clickMouse)
const clickAt = vi.mocked(input.clickAt)

beforeEach(() => {
  vi.clearAllMocks()
  detectionRunners.length = 0
})

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
  // Keep the augmentations off by default so each test opts in explicitly.
  p.holdKeys = { enabled: true, keys: [] }
  p.periodicKey = { enabled: false, entries: [] }
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

describe('SpamEngine — Hold Keys Down integration', () => {
  const holdKeyDown = vi.mocked(input.holdKeyDown)
  const releaseKey = vi.mocked(input.releaseKey)

  it('holds the enabled keys during a manual run and releases them on stop', async () => {
    const p = profile((p) => {
      p.entries = [key('a')]
      p.holdKeys = { enabled: true, keys: ['w', 'shift'] }
      p.loop = { mode: 'once', count: 1 }
    })
    await runToIdle(p)
    expect(holdKeyDown.mock.calls.map((c) => c[0])).toEqual(['w', 'shift'])
    expect(releaseKey.mock.calls.map((c) => c[0])).toEqual(['w', 'shift'])
    expect(pressedKeys()).toContain('a') // the keys-to-spam still ran too
  })

  it('does not hold keys when Hold Keys Down is disabled', async () => {
    const p = profile((p) => {
      p.entries = [key('a')]
      p.holdKeys = { enabled: false, keys: ['w'] }
      p.loop = { mode: 'once', count: 1 }
    })
    await runToIdle(p)
    expect(holdKeyDown).not.toHaveBeenCalled()
  })

  it('runs hold-only (no taps): holds until stopped, then releases', async () => {
    const p = profile((p) => {
      p.entries = []
      p.options.enableKeys = false
      p.options.enableClickPositions = false
      p.holdKeys = { enabled: true, keys: ['w'] }
      p.loop = { mode: 'forever', count: 1 }
    })
    const engine = new SpamEngine({ onStatus: () => {}, onError: () => {} })
    engine.start(p, 'manual')
    await new Promise((r) => setTimeout(r, 20))

    expect(engine.isRunning()).toBe(true)
    expect(holdKeyDown.mock.calls.map((c) => c[0])).toEqual(['w'])
    expect(releaseKey).not.toHaveBeenCalled() // still holding

    engine.stop()
    await new Promise((r) => setTimeout(r, 20))
    expect(releaseKey.mock.calls.map((c) => c[0])).toEqual(['w'])
    expect(engine.isRunning()).toBe(false)
  })

  it('holds a mouse button during a manual run and releases it on stop', async () => {
    const mouseButtonDown = vi.mocked(input.mouseButtonDown)
    const mouseButtonUp = vi.mocked(input.mouseButtonUp)
    const p = profile((p) => {
      p.entries = [key('a')]
      p.holdKeys = { enabled: true, keys: ['mouse-left'] }
      p.loop = { mode: 'once', count: 1 }
    })
    await runToIdle(p)
    expect(mouseButtonDown).toHaveBeenCalledWith('left')
    expect(mouseButtonUp).toHaveBeenCalledWith('left')
    expect(holdKeyDown).not.toHaveBeenCalled() // a mouse button isn't a keyboard hold
  })
})

describe('SpamEngine — Periodic Key integration', () => {
  const tapBinding = vi.mocked(input.tapBinding)

  it('runs each periodic entry on its own interval during a manual run, stopping on stop', async () => {
    const p = profile((p) => {
      p.entries = []
      p.options.enableKeys = false
      p.options.enableClickPositions = false
      p.periodicKey = {
        enabled: true,
        entries: [
          { id: 'pk1', key: 'f', intervalSec: 0.1 }, // 100 ms
          { id: 'pk2', key: 'g', intervalSec: 0.1 }
        ]
      }
      p.loop = { mode: 'forever', count: 1 }
    })
    const engine = new SpamEngine({ onStatus: () => {}, onError: () => {} })
    engine.start(p, 'manual')
    await new Promise((r) => setTimeout(r, 260))

    // Both independent timers fired.
    expect(tapBinding.mock.calls.some((c) => c[0] === 'f')).toBe(true)
    expect(tapBinding.mock.calls.some((c) => c[0] === 'g')).toBe(true)
    const callsAtStop = tapBinding.mock.calls.length
    engine.stop()
    await new Promise((r) => setTimeout(r, 160))
    // No further periodic presses after stopping (all timers cleared).
    expect(tapBinding.mock.calls.length).toBe(callsAtStop)
    expect(engine.isRunning()).toBe(false)
  })

  it('does not run the periodic presses when the section is disabled', async () => {
    const p = profile((p) => {
      p.entries = [key('a')]
      p.periodicKey = { enabled: false, entries: [{ id: 'pk1', key: 'f', intervalSec: 0.1 }] }
      p.loop = { mode: 'once', count: 1 }
    })
    await runToIdle(p)
    expect(tapBinding).not.toHaveBeenCalled()
  })
})

describe('SpamEngine — Hold-to-Spam (full spam while held)', () => {
  const holdKeyDown = vi.mocked(input.holdKeyDown)
  const releaseKey = vi.mocked(input.releaseKey)
  const keyDownName = vi.mocked(input.keyDownName)
  const tapBinding = vi.mocked(input.tapBinding)

  it('runs every enabled section (keys + hold keys + periodic) while held, looping until released', async () => {
    const p = profile((p) => {
      p.entries = [key('a')]
      p.holdKeys = { enabled: true, keys: ['w'] }
      p.periodicKey = { enabled: true, entries: [{ id: 'pk1', key: 'f', intervalSec: 0.1 }] } // 100 ms
      p.loop = { mode: 'once', count: 1 } // hold ignores Loop — runs while held
    })
    const engine = new SpamEngine({ onStatus: () => {}, onError: () => {} })
    engine.start(p, 'hold', 5)
    await new Promise((r) => setTimeout(r, 260))

    expect(engine.isRunning()).toBe(true) // Loop "once" did NOT end it (still held)
    expect(holdKeyDown).toHaveBeenCalledWith('w') // Hold Keys Down active
    expect(pressKey.mock.calls.some((c) => c[0] === 'a')).toBe(true) // Keys to Spam
    expect(tapBinding.mock.calls.some((c) => c[0] === 'f')).toBe(true) // Periodic Key

    engine.stop() // key released
    await new Promise((r) => setTimeout(r, 30))
    expect(releaseKey).toHaveBeenCalledWith('w') // released cleanly
    expect(engine.isRunning()).toBe(false)
  })

  it('plays the Macro while held when Macro is enabled', async () => {
    const p = profile((p) => {
      p.macro = {
        enabled: true,
        events: [
          { id: '1', type: 'key-down', delayMs: 5, key: 'b' },
          { id: '2', type: 'key-up', delayMs: 5, key: 'b' }
        ]
      }
      p.loop = { mode: 'once', count: 1 }
    })
    const engine = new SpamEngine({ onStatus: () => {}, onError: () => {} })
    engine.start(p, 'hold', 5)
    await new Promise((r) => setTimeout(r, 60))

    expect(keyDownName).toHaveBeenCalledWith('b')
    expect(engine.isRunning()).toBe(true) // loops while held
    engine.stop()
    await new Promise((r) => setTimeout(r, 30))
    expect(engine.isRunning()).toBe(false)
  })
})

describe('SpamEngine — Detection triggers integration', () => {
  const trigger = (mut: Partial<import('@shared/types').DetectionTrigger> = {}) => ({
    id: 'dt1',
    enabled: true,
    mode: 'color' as const,
    x: 10,
    y: 20,
    color: '#00ff00',
    tolerance: 10,
    repeatMs: 100,
    image: null,
    searchArea: null,
    action: { kind: 'key' as const, key: 'f', positionId: '' },
    ...mut
  })

  it('starts the detection watcher for the run and stops it on stop', async () => {
    const p = profile((p) => {
      p.entries = [key('a')]
      p.detection = { enabled: true, pollMs: 100, triggers: [trigger()] }
      p.loop = { mode: 'once', count: 1 }
    })
    await runToIdle(p)
    expect(detectionRunners.length).toBe(1)
    expect(detectionRunners[0].started).toBe(true)
    expect(detectionRunners[0].stopped).toBe(true)
  })

  it('runs detection-only (no taps): polls until stopped', async () => {
    const p = profile((p) => {
      p.entries = []
      p.options.enableKeys = false
      p.options.enableClickPositions = false
      p.detection = { enabled: true, pollMs: 100, triggers: [trigger()] }
      p.loop = { mode: 'forever', count: 1 }
    })
    const engine = new SpamEngine({ onStatus: () => {}, onError: () => {} })
    engine.start(p, 'manual')
    await new Promise((r) => setTimeout(r, 20))

    expect(engine.isRunning()).toBe(true)
    expect(detectionRunners.length).toBe(1)
    expect(detectionRunners[0].started).toBe(true)
    expect(detectionRunners[0].stopped).toBe(false)

    engine.stop()
    await new Promise((r) => setTimeout(r, 20))
    expect(detectionRunners[0].stopped).toBe(true)
    expect(engine.isRunning()).toBe(false)
  })

  it('does not start the watcher when the section is disabled', async () => {
    const p = profile((p) => {
      p.entries = [key('a')]
      p.detection = { enabled: false, pollMs: 100, triggers: [trigger()] }
      p.loop = { mode: 'once', count: 1 }
    })
    await runToIdle(p)
    expect(detectionRunners.length).toBe(0)
  })

  it('does not start the watcher when every trigger is off or unset', async () => {
    const p = profile((p) => {
      p.entries = [key('a')]
      p.detection = {
        enabled: true,
        pollMs: 100,
        triggers: [trigger({ enabled: false }), trigger({ id: 'dt2', color: '' })]
      }
      p.loop = { mode: 'once', count: 1 }
    })
    await runToIdle(p)
    expect(detectionRunners.length).toBe(0)
  })

  it('warns (and does not start the watcher) when a trigger has no action bound', async () => {
    const p = profile((p) => {
      p.entries = [key('a')]
      p.detection = {
        enabled: true,
        pollMs: 100,
        triggers: [trigger({ action: { kind: 'key', key: '', positionId: '' } })]
      }
      p.loop = { mode: 'once', count: 1 }
    })
    const { errors } = await runToIdle(p)
    expect(detectionRunners.length).toBe(0)
    expect(errors.some((m) => /detection trigger #1/i.test(m) && /no key bound/i.test(m))).toBe(true)
  })

  it('warns when a trigger points at a deleted click position', async () => {
    const p = profile((p) => {
      p.entries = [key('a')]
      p.clickPositions = []
      p.detection = {
        enabled: true,
        pollMs: 100,
        triggers: [trigger({ action: { kind: 'position', key: '', positionId: 'gone' } })]
      }
      p.loop = { mode: 'once', count: 1 }
    })
    const { errors } = await runToIdle(p)
    expect(detectionRunners.length).toBe(0)
    expect(errors.some((m) => /position no longer exists/i.test(m))).toBe(true)
  })

  it('runs a position-action trigger when its click position exists', async () => {
    const p = profile((p) => {
      p.entries = [key('a')]
      p.clickPositions = [{ id: 'cp1', x: 5, y: 6, button: 'left', delayMs: null }]
      p.detection = {
        enabled: true,
        pollMs: 100,
        triggers: [trigger({ action: { kind: 'position', key: '', positionId: 'cp1' } })]
      }
      p.loop = { mode: 'once', count: 1 }
    })
    const { errors } = await runToIdle(p)
    expect(detectionRunners.length).toBe(1)
    expect(errors).toEqual([])
  })

  it('does not run detection for the focused hold modes', async () => {
    const p = profile((p) => {
      p.focusHold = { enabled: true, key: 'f', delayMs: 5 }
      p.detection = { enabled: true, pollMs: 100, triggers: [trigger()] }
    })
    const engine = new SpamEngine({ onStatus: () => {}, onError: () => {} })
    engine.start(p, 'focus-hold')
    await new Promise((r) => setTimeout(r, 20))
    engine.stop()
    await new Promise((r) => setTimeout(r, 20))
    expect(detectionRunners.length).toBe(0)
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

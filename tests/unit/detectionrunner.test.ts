import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { DetectionConfig, ClickPosition } from '@shared/types'

// The runner reads the screen through nut-js and decodes templates through
// Electron's nativeImage; both are stubbed so the test drives pure logic. The
// stubbed colorAt returns whatever `screenColor` currently holds, so a test can
// flip the "condition" on and off between ticks.
let screenColor = { R: 0, G: 0, B: 0, A: 255 }
vi.mock('@nut-tree-fork/nut-js', () => ({
  screen: {
    width: vi.fn(() => Promise.resolve(1920)),
    height: vi.fn(() => Promise.resolve(1080)),
    // grabRegion is used by the batched pixel read: return a 1x1 BGRA buffer
    // painted with the current screenColor (covers the single-pixel bounding box).
    grabRegion: vi.fn(() =>
      Promise.resolve({
        width: 1,
        height: 1,
        channels: 4,
        byteWidth: 4,
        data: Buffer.from([screenColor.B, screenColor.G, screenColor.R, 255])
      })
    )
  },
  Point: class {
    constructor(
      public x: number,
      public y: number
    ) {}
  },
  Region: class {
    constructor(
      public left: number,
      public top: number,
      public width: number,
      public height: number
    ) {}
  }
}))

vi.mock('electron', () => ({ nativeImage: { createFromDataURL: vi.fn(), createFromBitmap: vi.fn() } }))

const tapBinding = vi.fn((_name: string, _holdMs: number) => Promise.resolve())
vi.mock('../../src/main/input', () => ({
  tapBindingHeld: (name: string, holdMs: number) => tapBinding(name, holdMs),
  clickAtHeld: vi.fn(() => Promise.resolve())
}))

import { DetectionRunner } from '../../src/main/detection'

const RED = '#ff0000'
function config(over: Partial<DetectionConfig['triggers'][number]> = {}, pollMs = 10): DetectionConfig {
  return {
    enabled: true,
    pollMs,
    triggers: [
      {
        id: 't1',
        enabled: true,
        mode: 'color',
        x: 100,
        y: 100,
        color: RED,
        tolerance: 10,
        repeatMs: 50,
        lingerMs: 0,
        holdMs: 0,
        image: null,
        searchArea: null,
        action: { kind: 'key', key: 'a', positionId: '' },
        ...over
      }
    ]
  }
}
const noPositions: ClickPosition[] = []

beforeEach(() => {
  vi.useFakeTimers()
  tapBinding.mockClear()
  screenColor = { R: 0, G: 0, B: 0, A: 255 } // condition starts false
})
afterEach(() => vi.useRealTimers())

/** Advance fake time while letting the runner's awaited async ticks settle. */
async function advance(ms: number, step = 10): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    await vi.advanceTimersByTimeAsync(step)
  }
}

describe('DetectionRunner — repeat while true', () => {
  it('does not fire while the condition is false', async () => {
    const r = new DetectionRunner(config(), noPositions, () => {})
    r.start()
    await advance(200)
    r.stop()
    expect(tapBinding).not.toHaveBeenCalled()
  })

  it('fires immediately when the condition becomes true, then repeats every repeatMs', async () => {
    const r = new DetectionRunner(config({ repeatMs: 50 }, 10), noPositions, () => {})
    r.start()
    await advance(20) // condition still false
    expect(tapBinding).not.toHaveBeenCalled()

    screenColor = { R: 255, G: 0, B: 0, A: 255 } // ability off cooldown
    await advance(210) // ~200 ms of true at 50 ms repeat -> ~5 fires (t=0,50,100,150,200)
    r.stop()
    const count = tapBinding.mock.calls.length
    expect(count).toBeGreaterThanOrEqual(4)
    expect(count).toBeLessThanOrEqual(6)
    expect(tapBinding).toHaveBeenCalledWith('a', expect.any(Number))
  })

  it('keeps firing while true even though the first press "did not take" (stun scenario)', async () => {
    const r = new DetectionRunner(config({ repeatMs: 50 }, 10), noPositions, () => {})
    r.start()
    screenColor = { R: 255, G: 0, B: 0, A: 255 } // stays true the whole time (stunned)
    await advance(300)
    r.stop()
    // Far more than one press — it retries the entire time the condition holds.
    expect(tapBinding.mock.calls.length).toBeGreaterThan(3)
  })

  it('stops firing once the condition goes false again (linger 0)', async () => {
    const r = new DetectionRunner(config({ repeatMs: 50, lingerMs: 0 }, 10), noPositions, () => {})
    r.start()
    screenColor = { R: 255, G: 0, B: 0, A: 255 }
    await advance(120)
    const afterTrue = tapBinding.mock.calls.length
    expect(afterTrue).toBeGreaterThan(0)

    screenColor = { R: 0, G: 0, B: 0, A: 255 } // back on cooldown
    await advance(200)
    r.stop()
    // No further presses after the condition cleared.
    expect(tapBinding.mock.calls.length).toBe(afterTrue)
  })

  it('keeps firing through a brief dip within the linger window, then stops', async () => {
    // linger 300 ms bridges a short false blip (icon flash / global cooldown).
    const r = new DetectionRunner(config({ repeatMs: 50, lingerMs: 300 }, 10), noPositions, () => {})
    r.start()
    screenColor = { R: 255, G: 0, B: 0, A: 255 } // matches
    await advance(120)
    const beforeDip = tapBinding.mock.calls.length
    expect(beforeDip).toBeGreaterThan(0)

    // Brief dip (150 ms < 300 ms linger): firing must CONTINUE.
    screenColor = { R: 0, G: 0, B: 0, A: 255 }
    await advance(150)
    const duringDip = tapBinding.mock.calls.length
    expect(duringDip).toBeGreaterThan(beforeDip) // kept firing through the dip

    // Condition returns — still going.
    screenColor = { R: 255, G: 0, B: 0, A: 255 }
    await advance(100)
    const afterReturn = tapBinding.mock.calls.length
    expect(afterReturn).toBeGreaterThan(duringDip)

    // Now a LONG dip beyond the linger window: firing must stop.
    screenColor = { R: 0, G: 0, B: 0, A: 255 }
    await advance(400)
    const settled = tapBinding.mock.calls.length
    await advance(300)
    r.stop()
    expect(tapBinding.mock.calls.length).toBe(settled) // no fires after linger expired
  })

  it('passes the trigger hold duration through to the action', async () => {
    const r = new DetectionRunner(config({ repeatMs: 50, holdMs: 75 }), noPositions, () => {})
    r.start()
    screenColor = { R: 255, G: 0, B: 0, A: 255 }
    await advance(60)
    r.stop()
    expect(tapBinding).toHaveBeenCalledWith('a', 75) // name + holdMs
  })

  it('fires nothing at all after stop()', async () => {
    const r = new DetectionRunner(config(), noPositions, () => {})
    r.start()
    screenColor = { R: 255, G: 0, B: 0, A: 255 }
    r.stop()
    await advance(200)
    expect(tapBinding).not.toHaveBeenCalled()
  })
})

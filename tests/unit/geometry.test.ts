import { describe, it, expect } from 'vitest'
import { pointInRect, type Rect } from '../../src/main/geometry'

// The Auto Spammer window, expressed in physical screen pixels. While recording,
// clicks that land inside this rect (e.g. on the "Stop Recording" button) must be
// dropped; clicks anywhere else (a game/other window) must be recorded.
const windowRect: Rect = { x: 100, y: 80, width: 760, height: 740 }

describe('pointInRect — filtering clicks on our own window while recording', () => {
  it('treats a click in the middle of the window as inside (ignored)', () => {
    expect(pointInRect(480, 450, windowRect)).toBe(true)
  })

  it('treats clicks in other windows / on the desktop as outside (recorded)', () => {
    expect(pointInRect(50, 50, windowRect)).toBe(false) // above-left
    expect(pointInRect(1500, 900, windowRect)).toBe(false) // far away (e.g. a game)
    expect(pointInRect(480, 60, windowRect)).toBe(false) // just above the window
  })

  it('includes the top-left corner but excludes the bottom-right edge', () => {
    expect(pointInRect(100, 80, windowRect)).toBe(true) // top-left corner is inside
    expect(pointInRect(860, 820, windowRect)).toBe(false) // bottom-right edge is exclusive
    expect(pointInRect(859, 819, windowRect)).toBe(true) // last pixel inside
  })

  it('rejects points one pixel outside each edge', () => {
    expect(pointInRect(99, 450, windowRect)).toBe(false) // left of left edge
    expect(pointInRect(480, 79, windowRect)).toBe(false) // above top edge
  })
})

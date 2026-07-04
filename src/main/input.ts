import { keyboard, mouse, Button, Point } from '@nut-tree-fork/nut-js'
import { nutKeyFor, nutHoldKey, keycodeForName } from './keymap'
import type { MousePoint } from '@shared/types'

// Fire as fast as the OS allows; we manage our own pacing in the engine.
keyboard.config.autoDelayMs = 0
mouse.config.autoDelayMs = 0

// ---------------------------------------------------------------------------
// Synthetic-input accounting (precise, per key).
//
// nut-js drives input through the OS, so uiohook sees our simulated presses as
// if they were physical. We must not mistake our own input for the user's.
//
// Key fact: while a key is *physically held*, Windows emits repeated KEYDOWNs
// (auto-repeat) but NO keyup until the user actually releases it. So the only
// event the hold listeners truly need protected is the keyUP — and they only
// need to ignore the ups WE generate. We therefore record every synthetic up we
// emit; an unaccounted keyup is, by definition, the user's real release. This
// fixes Focus Hold, where the spammed key is the same key being watched.
// ---------------------------------------------------------------------------
const PENDING_TTL_MS = 250

// token (`k:<keycode>` / `m:<button>`) -> queue of expiry timestamps, one per
// synthetic up we expect uiohook to deliver back to us.
const pendingUps = new Map<string, number[]>()

function recordSyntheticUp(token: string | null): void {
  if (!token) return
  const arr = pendingUps.get(token) ?? []
  arr.push(Date.now() + PENDING_TTL_MS)
  pendingUps.set(token, arr)
}

/**
 * Try to attribute an observed keyup/mouseup to our own synthetic input.
 * Returns true if it was ours (and should be ignored), false if it's the user.
 */
export function consumeSyntheticUp(token: string): boolean {
  const arr = pendingUps.get(token)
  if (!arr || arr.length === 0) return false
  const now = Date.now()
  // Discard stale entries for ups we apparently never received back.
  while (arr.length > 0 && arr[0] < now) arr.shift()
  if (arr.length === 0) return false
  arr.shift()
  return true
}

/** Forget all outstanding synthetic ups (called when a run ends). */
export function clearSynthetic(): void {
  pendingUps.clear()
}

function keyToken(name: string): string | null {
  const code = keycodeForName(name)
  return code === null ? null : `k:${code}`
}

/** Press and release a single logical key. */
export async function pressKey(name: string): Promise<void> {
  const token = keyToken(name)
  recordSyntheticUp(token)
  try {
    const nutKey = nutKeyFor(name)
    if (nutKey !== null) {
      await keyboard.type(nutKey)
    } else {
      // Printable single characters (and anything not in the special table)
      // are typed literally.
      await keyboard.type(name)
    }
  } catch (err) {
    if (token) consumeSyntheticUp(token) // injection failed; no up will arrive
    throw err
  }
}

/** Type a full string in one go. */
export async function typeText(text: string): Promise<void> {
  // Text bursts use keys unrelated to a single hold/focus key, so no accounting
  // is needed: their ups simply won't match the watched key's token.
  if (text) await keyboard.type(text)
}

export async function clickMouse(button: 'left' | 'right' | 'middle'): Promise<void> {
  const num = button === 'right' ? 2 : button === 'middle' ? 3 : 1
  const nutBtn = button === 'right' ? Button.RIGHT : button === 'middle' ? Button.MIDDLE : Button.LEFT
  const token = `m:${num}`
  recordSyntheticUp(token)
  try {
    await mouse.click(nutBtn)
  } catch (err) {
    consumeSyntheticUp(token)
    throw err
  }
}

/**
 * Tap a key OR mouse button once — used by the periodic presses. Left/right/middle
 * clicks are supported; nut-js can't synthesize extra-button (MB4/MB5) clicks, so
 * those are ignored.
 */
export async function tapBinding(name: string): Promise<void> {
  switch (name) {
    case 'mouse-left':
      return clickMouse('left')
    case 'mouse-right':
      return clickMouse('right')
    case 'mouse-middle':
      return clickMouse('middle')
    case 'mouse-4':
    case 'mouse-5':
      return // not synthesizable
    default:
      return pressKey(name)
  }
}

/** Move the cursor to a screen position and click there. */
export async function clickAt(x: number, y: number, button: 'left' | 'right'): Promise<void> {
  const token = `m:${button === 'left' ? 1 : 2}`
  recordSyntheticUp(token)
  try {
    await mouse.setPosition(new Point(x, y))
    await mouse.click(button === 'left' ? Button.LEFT : Button.RIGHT)
  } catch (err) {
    consumeSyntheticUp(token)
    throw err
  }
}

// ---------------------------------------------------------------------------
// Held taps/clicks — hold the input DOWN for a few frames before releasing.
//
// nut-js's default click/type presses and releases within microseconds. Apps
// reading the Windows message queue catch every one, but MANY GAMES poll the
// raw button/key STATE once per rendered frame; an instantaneous press+release
// lands between two polls and is never seen. Holding for ~40-60 ms guarantees
// the state is sampled by at least one frame, so the game reliably registers
// the click/press. `holdMs <= 0` falls back to the instantaneous path.
// ---------------------------------------------------------------------------
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function nutButtonFor(button: 'left' | 'right' | 'middle'): Button {
  return button === 'right' ? Button.RIGHT : button === 'middle' ? Button.MIDDLE : Button.LEFT
}

/** Press a mouse button, hold it `holdMs`, then release (accounted for). */
async function heldClickButton(button: 'left' | 'right' | 'middle', holdMs: number): Promise<void> {
  const num = button === 'right' ? 2 : button === 'middle' ? 3 : 1
  const nutBtn = nutButtonFor(button)
  await mouse.pressButton(nutBtn)
  try {
    if (holdMs > 0) await sleep(holdMs)
  } finally {
    recordSyntheticUp(`m:${num}`)
    await mouse.releaseButton(nutBtn)
  }
}

/** A key held down for `holdMs` then released. Returns false if unholdable. */
async function heldKey(name: string, holdMs: number): Promise<boolean> {
  const key = nutHoldKey(name)
  if (key === null) return false
  await keyboard.pressKey(key)
  try {
    if (holdMs > 0) await sleep(holdMs)
  } finally {
    recordSyntheticUp(keyToken(name))
    await keyboard.releaseKey(key)
  }
  return true
}

/**
 * Tap a key or mouse button but hold it down for `holdMs` so state-polling
 * games register it. Used by Detection triggers. Keys nut-js can't hold (and
 * any holdMs <= 0) fall back to the instantaneous tap.
 */
export async function tapBindingHeld(name: string, holdMs: number): Promise<void> {
  if (holdMs <= 0) return tapBinding(name)
  switch (name) {
    case 'mouse-left':
      return heldClickButton('left', holdMs)
    case 'mouse-right':
      return heldClickButton('right', holdMs)
    case 'mouse-middle':
      return heldClickButton('middle', holdMs)
    case 'mouse-4':
    case 'mouse-5':
      return // not synthesizable
    default:
      // Fall back to an instant press for keys nut-js can't hold down.
      if (!(await heldKey(name, holdMs))) return pressKey(name)
  }
}

/** Move the cursor to a screen position and click, holding for `holdMs`. */
export async function clickAtHeld(
  x: number,
  y: number,
  button: 'left' | 'right',
  holdMs: number
): Promise<void> {
  if (holdMs <= 0) return clickAt(x, y, button)
  await mouse.setPosition(new Point(x, y))
  await heldClickButton(button, holdMs)
}

/** Current cursor position, used when recording a click spot. */
export async function getMousePosition(): Promise<MousePoint> {
  const p = await mouse.getPosition()
  return { x: Math.round(p.x), y: Math.round(p.y) }
}

// ---------------------------------------------------------------------------
// Low-level primitives for macro playback. These reproduce individual recorded
// events (separate down/up, raw moves) rather than complete press/click cycles.
// Macro playback runs with the global hook suppressed, so no synthetic-up
// accounting is needed here.
// ---------------------------------------------------------------------------
function nutButton(button: 'left' | 'right' | 'middle'): Button {
  if (button === 'right') return Button.RIGHT
  if (button === 'middle') return Button.MIDDLE
  return Button.LEFT
}

/** Move the cursor to an absolute screen position (no click). */
export async function mouseMove(x: number, y: number): Promise<void> {
  await mouse.setPosition(new Point(Math.round(x), Math.round(y)))
}

export async function mouseButtonDown(button: 'left' | 'right' | 'middle'): Promise<void> {
  await mouse.pressButton(nutButton(button))
}

export async function mouseButtonUp(button: 'left' | 'right' | 'middle'): Promise<void> {
  await mouse.releaseButton(nutButton(button))
}

/** Press a single key DOWN (no release). No-op for keys nut-js can't hold. */
export async function keyDownName(name: string): Promise<void> {
  const key = nutHoldKey(name)
  if (key !== null) await keyboard.pressKey(key)
}

/** Release a single key. No-op for keys nut-js can't hold. */
export async function keyUpName(name: string): Promise<void> {
  const key = nutHoldKey(name)
  if (key !== null) await keyboard.releaseKey(key)
}

/** Press a key DOWN and keep it held. Returns false if the key can't be held. */
export async function holdKeyDown(name: string): Promise<boolean> {
  const key = nutHoldKey(name)
  if (key === null) return false
  await keyboard.pressKey(key)
  return true
}

/** Release a previously held key. */
export async function releaseKey(name: string): Promise<void> {
  const key = nutHoldKey(name)
  if (key === null) return
  // The release produces a keyup; account for it so hold listeners ignore it.
  recordSyntheticUp(keyToken(name))
  await keyboard.releaseKey(key)
}

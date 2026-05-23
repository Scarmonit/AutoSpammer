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

export async function clickMouse(button: 'left' | 'right'): Promise<void> {
  const token = `m:${button === 'left' ? 1 : 2}`
  recordSyntheticUp(token)
  try {
    await mouse.click(button === 'left' ? Button.LEFT : Button.RIGHT)
  } catch (err) {
    consumeSyntheticUp(token)
    throw err
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

/** Current cursor position, used when recording a click spot. */
export async function getMousePosition(): Promise<MousePoint> {
  const p = await mouse.getPosition()
  return { x: Math.round(p.x), y: Math.round(p.y) }
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

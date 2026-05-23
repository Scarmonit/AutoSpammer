import { keyboard, mouse, Button } from '@nut-tree-fork/nut-js'
import { nutKeyFor } from './keymap'

// Fire as fast as the OS allows; we manage our own pacing in the engine.
keyboard.config.autoDelayMs = 0
mouse.config.autoDelayMs = 0

// ---------------------------------------------------------------------------
// Synthetic-input guard.
//
// nut-js drives input through the OS, so uiohook sees our simulated presses as
// if they were physical. The hold-to-spam listeners must ignore those, or a
// simulated key could be misread as the user pressing/releasing the hold key.
// We raise a guard around every synthetic action plus a short cooldown tail to
// cover events the OS delivers slightly late.
// ---------------------------------------------------------------------------
let syntheticDepth = 0
let cooldownUntil = 0
const COOLDOWN_MS = 15

export function isSynthetic(): boolean {
  return syntheticDepth > 0 || Date.now() < cooldownUntil
}

function begin(): void {
  syntheticDepth += 1
}

function end(): void {
  syntheticDepth = Math.max(0, syntheticDepth - 1)
  cooldownUntil = Date.now() + COOLDOWN_MS
}

/** Press and release a single logical key. */
export async function pressKey(name: string): Promise<void> {
  begin()
  try {
    const nutKey = nutKeyFor(name)
    if (nutKey !== null) {
      await keyboard.type(nutKey)
    } else {
      // Printable single characters (and anything not in the special table)
      // are typed literally.
      await keyboard.type(name)
    }
  } finally {
    end()
  }
}

/** Type a full string in one go. */
export async function typeText(text: string): Promise<void> {
  if (!text) return
  begin()
  try {
    await keyboard.type(text)
  } finally {
    end()
  }
}

export async function clickMouse(button: 'left' | 'right'): Promise<void> {
  begin()
  try {
    await mouse.click(button === 'left' ? Button.LEFT : Button.RIGHT)
  } finally {
    end()
  }
}

// Tiny, dependency-free geometry helpers so the "is this click inside our own
// window?" decision can be unit-tested without Electron or the native hooks.

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * True if the screen point (x, y) lies within `rect`. The right/bottom edges are
 * treated as exclusive, matching how a window's content area is addressed.
 */
export function pointInRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height
}

import React, { createContext, useContext } from 'react'

/**
 * The stable id of the section a component is rendered within. `ResizablePane`
 * supplies it so the generic `Section` wrapper can read/write its own per-profile
 * layout state (collapsed / height) without every panel having to thread an id.
 */
export const SectionIdContext = createContext<string | null>(null)

export function useSectionId(): string | null {
  return useContext(SectionIdContext)
}

/**
 * Drag-to-reorder handle wiring. `ResizablePane` provides these so the grip in a
 * section header (rendered by `Section`) can be the ONLY draggable element. The
 * pane itself is intentionally NOT draggable: making a whole pane draggable
 * hijacks mouse interactions in the body (text selection, inputs) and cancels the
 * nested key-row drags — the same Chromium quirk `KeyRow` already works around.
 */
export interface SectionDragHandlers {
  draggable: boolean
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
}

export const SectionDragContext = createContext<SectionDragHandlers | null>(null)

export function useSectionDrag(): SectionDragHandlers | null {
  return useContext(SectionDragContext)
}

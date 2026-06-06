import React, { useRef } from 'react'
import { useStore } from '../store'
import { SectionIdContext } from './sectionContext'

/** Clamp range for a draggable section, in pixels. */
const MIN_HEIGHT = 64
const MAX_HEIGHT = 2000

interface Props {
  /** Stable section id used as the key for the saved height. */
  id: string
  /** The last pane in a column has no splitter beneath it. */
  last?: boolean
  /** True while this pane is the one being dragged (for the fade effect). */
  dragging?: boolean
  /** Drag started from the section header (drag-to-reorder). */
  onPaneDragStart?: (id: string) => void
  onPaneDragEnd?: () => void
  children: React.ReactNode
}

/**
 * Wraps a single section and (unless it's the last in its column) renders a thin
 * horizontal splitter beneath it. Dragging the splitter resizes THIS pane; the
 * panes below simply reflow and the column scrolls if needed.
 *
 * During a drag the pane's height is written straight to the DOM node for smooth,
 * re-render-free feedback; the final height is committed to the store (and saved
 * per profile) on mouse-up. Double-clicking the splitter clears the saved height.
 */
export function ResizablePane({
  id,
  last = false,
  dragging = false,
  onPaneDragStart,
  onPaneDragEnd,
  children
}: Props): JSX.Element {
  const { activeProfile, setSectionHeight, resetSectionHeight } = useStore()
  const paneRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startY: number; startH: number } | null>(null)

  const collapsed = !!activeProfile?.collapsedSections?.[id]
  // A collapsed section is header-only, so ignore any saved height while hidden.
  const storedHeight = collapsed ? undefined : activeProfile?.sectionHeights?.[id]

  const onMouseMove = (e: MouseEvent): void => {
    const d = drag.current
    const el = paneRef.current
    if (!d || !el) return
    const h = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, d.startH + (e.clientY - d.startY)))
    el.style.height = `${h}px`
  }

  const endDrag = (): void => {
    const el = paneRef.current
    if (drag.current && el) {
      setSectionHeight(id, Math.round(el.getBoundingClientRect().height))
    }
    drag.current = null
    document.body.classList.remove('is-resizing')
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', endDrag)
  }

  const startDrag = (e: React.MouseEvent): void => {
    const el = paneRef.current
    if (!el) return
    e.preventDefault()
    drag.current = { startY: e.clientY, startH: el.getBoundingClientRect().height }
    document.body.classList.add('is-resizing')
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', endDrag)
  }

  // Reorder drag (HTML5): only starts when grabbed by the section header, so
  // inputs/buttons in the body stay usable and key-row drags aren't hijacked.
  const onDragStart = (e: React.DragEvent): void => {
    if (!(e.target instanceof Element) || !e.target.closest('.section__head')) {
      e.preventDefault()
      return
    }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
    onPaneDragStart?.(id)
  }

  return (
    <>
      <div
        className={`rs-pane${collapsed ? ' rs-pane--collapsed' : ''}${dragging ? ' rs-pane--dragging' : ''}`}
        ref={paneRef}
        style={storedHeight ? { height: storedHeight } : undefined}
        data-rs-pane
        data-section-id={id}
        draggable
        onDragStart={onDragStart}
        onDragEnd={() => onPaneDragEnd?.()}
      >
        <SectionIdContext.Provider value={id}>{children}</SectionIdContext.Provider>
      </div>
      {!last && (
        <div
          className={`rs-splitter${collapsed ? ' rs-splitter--disabled' : ''}`}
          role="separator"
          aria-orientation="horizontal"
          // A collapsed section can't be resized; the splitter is just a spacer.
          title={collapsed ? undefined : 'Drag to resize · double-click to reset'}
          onMouseDown={collapsed ? undefined : startDrag}
          onDoubleClick={collapsed ? undefined : () => resetSectionHeight(id)}
        />
      )}
    </>
  )
}

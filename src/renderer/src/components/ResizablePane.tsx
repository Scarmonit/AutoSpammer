import React, { useRef } from 'react'
import { useStore } from '../store'

/** Clamp range for a draggable section, in pixels. */
const MIN_HEIGHT = 64
const MAX_HEIGHT = 2000

interface Props {
  /** Stable section id used as the key for the saved height. */
  id: string
  /** The last pane in a column has no splitter beneath it. */
  last?: boolean
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
export function ResizablePane({ id, last = false, children }: Props): JSX.Element {
  const { activeProfile, setSectionHeight, resetSectionHeight } = useStore()
  const paneRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startY: number; startH: number } | null>(null)

  const storedHeight = activeProfile?.sectionHeights?.[id]

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

  return (
    <>
      <div
        className="rs-pane"
        ref={paneRef}
        style={storedHeight ? { height: storedHeight } : undefined}
      >
        {children}
      </div>
      {!last && (
        <div
          className="rs-splitter"
          role="separator"
          aria-orientation="horizontal"
          title="Drag to resize · double-click to reset"
          onMouseDown={startDrag}
          onDoubleClick={() => resetSectionHeight(id)}
        />
      )}
    </>
  )
}

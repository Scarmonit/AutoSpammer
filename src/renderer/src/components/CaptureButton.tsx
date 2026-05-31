import React, { useEffect, useRef, useState } from 'react'
import { toName, toAccelerator } from '../keycapture'

interface Props {
  label: string
  /** 'name' captures a single logical key; 'accelerator' captures an Electron hotkey. */
  mode: 'name' | 'accelerator'
  /** When true, a left/right mouse click is also accepted (hold-key fields). */
  allowMouse?: boolean
  onCapture: (value: string) => void
  className?: string
}

// Only ONE CaptureButton may listen at a time. Starting a capture cancels any
// other in-progress one, so a single key press can never bind to two fields.
let cancelActiveCapture: (() => void) | null = null

/**
 * A button that, when clicked, listens for the next key press (and optionally a
 * mouse click) and reports it back as either a logical name or an accelerator.
 * Click it again — or start another capture — to cancel. Escape (and modified
 * combos like Ctrl+Shift+K) bind normally.
 */
export function CaptureButton({
  label,
  mode,
  allowMouse,
  onCapture,
  className
}: Props): JSX.Element {
  const [listening, setListening] = useState(false)

  // Stable identity so the shared capture slot can be cleared by this instance.
  const selfCancel = useRef<() => void>()
  if (!selfCancel.current) selfCancel.current = (): void => setListening(false)

  useEffect(() => {
    if (!listening) return
    const self = selfCancel.current as () => void

    // Claim the single capture slot, cancelling whoever currently holds it.
    if (cancelActiveCapture && cancelActiveCapture !== self) cancelActiveCapture()
    cancelActiveCapture = self

    const finish = (value: string | null): void => {
      setListening(false)
      if (value) onCapture(value)
    }

    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      // For accelerators, a lone modifier isn't a binding — keep waiting so combos
      // like Ctrl+Shift+K work. (For 'name' mode, Shift/Ctrl/Alt are valid keys.)
      if (
        mode === 'accelerator' &&
        (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta')
      ) {
        return
      }
      finish(mode === 'accelerator' ? toAccelerator(e) : toName(e))
    }

    const onMouse = (e: MouseEvent): void => {
      // Clicks on any "Set Key" button are for starting/cancelling capture, not
      // for binding a mouse button — let that button's own onClick handle it.
      if (e.target instanceof Element && e.target.closest('[data-capture-button]')) return
      if (!allowMouse) return
      e.preventDefault()
      e.stopPropagation()
      if (e.button === 0) finish('mouse-left')
      else if (e.button === 2) finish('mouse-right')
    }

    window.addEventListener('keydown', onKey, true)
    window.addEventListener('mousedown', onMouse, true)
    window.addEventListener('contextmenu', preventContext, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('mousedown', onMouse, true)
      window.removeEventListener('contextmenu', preventContext, true)
      if (cancelActiveCapture === self) cancelActiveCapture = null
    }
  }, [listening, mode, allowMouse, onCapture])

  return (
    <button
      type="button"
      data-capture-button="true"
      className={`btn ${className ?? ''} ${listening ? 'btn--listening' : ''}`}
      onClick={() => setListening((v) => !v)}
    >
      {listening ? 'Press a key…' : label}
    </button>
  )
}

function preventContext(e: Event): void {
  e.preventDefault()
}

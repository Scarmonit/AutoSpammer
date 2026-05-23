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

/**
 * A button that, when clicked, listens for the next key press (and optionally a
 * mouse click) and reports it back as either a logical name or an accelerator.
 */
export function CaptureButton({
  label,
  mode,
  allowMouse,
  onCapture,
  className
}: Props): JSX.Element {
  const [listening, setListening] = useState(false)
  const armedAt = useRef(0)

  useEffect(() => {
    if (!listening) return

    const finish = (value: string | null): void => {
      setListening(false)
      if (value) onCapture(value)
    }

    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') return finish(null)
      finish(mode === 'accelerator' ? toAccelerator(e) : toName(e))
    }

    const onMouse = (e: MouseEvent): void => {
      // Ignore the click that started capture.
      if (Date.now() - armedAt.current < 220) return
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
    }
  }, [listening, mode, allowMouse, onCapture])

  return (
    <button
      type="button"
      className={`btn ${className ?? ''} ${listening ? 'btn--listening' : ''}`}
      onClick={() => {
        armedAt.current = Date.now()
        setListening(true)
      }}
    >
      {listening ? 'Press a key…' : label}
    </button>
  )
}

function preventContext(e: Event): void {
  e.preventDefault()
}

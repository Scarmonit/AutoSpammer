import React, { useState } from 'react'
import { CaptureOverlay } from './CaptureOverlay'

interface Props {
  label: string
  /** 'name' captures a single logical key; 'accelerator' captures an Electron hotkey. */
  mode: 'name' | 'accelerator'
  onCapture: (value: string) => void
  className?: string
}

/**
 * A button that, when clicked, opens the shared full-screen capture overlay
 * and reports the next key press / mouse click back as either a logical name
 * or an accelerator. Esc closes the overlay without changing the binding.
 */
export function CaptureButton({ label, mode, onCapture, className }: Props): JSX.Element {
  const [capturing, setCapturing] = useState(false)

  return (
    <>
      <button
        type="button"
        className={`btn ${className ?? ''} ${capturing ? 'btn--listening' : ''}`}
        onClick={() => setCapturing(true)}
      >
        {label}
      </button>
      {capturing && (
        <CaptureOverlay
          mode={mode}
          onDone={(value) => {
            setCapturing(false)
            if (value) onCapture(value)
          }}
        />
      )}
    </>
  )
}

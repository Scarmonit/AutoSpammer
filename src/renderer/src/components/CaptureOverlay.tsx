import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { toName, toAccelerator, toMouseName } from '../keycapture'

interface Props {
  /** 'name' captures a single logical key; 'accelerator' captures an Electron hotkey. */
  mode: 'name' | 'accelerator'
  /** Called exactly once: with the captured value, or null when cancelled (Esc). */
  onDone: (value: string | null) => void
}

function preventContext(e: Event): void {
  e.preventDefault()
}

/**
 * Full-screen key-capture overlay: dims and blurs the whole app, shows
 * "Press any key or mouse button", and reports the first key/button pressed.
 * Esc cancels without changing the binding.
 *
 * While mounted, the main process suspends every global hotkey and hold
 * trigger (capture:start/stop IPC), so pressing e.g. the start/stop hotkey is
 * captured as the new binding instead of starting a run.
 */
export function CaptureOverlay({ mode, onDone }: Props): JSX.Element {
  useEffect(() => {
    void window.api.captureStart()

    const finish = (value: string | null): void => onDone(value)

    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        finish(null)
        return
      }
      // For accelerators, a lone modifier isn't a binding — keep waiting so
      // combos like Ctrl+Shift+K work. (For 'name' mode, Shift/Ctrl/Alt are
      // valid keys in their own right.)
      if (
        mode === 'accelerator' &&
        (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta')
      ) {
        return
      }
      const value = mode === 'accelerator' ? toAccelerator(e) : toName(e)
      if (value) finish(value) // unknown keys keep the overlay waiting
    }

    const onMouse = (e: MouseEvent): void => {
      const name = toMouseName(e)
      if (!name) return
      e.preventDefault()
      e.stopPropagation()
      finish(name) // mouse buttons bind for both 'name' and 'accelerator' fields
    }

    window.addEventListener('keydown', onKey, true)
    window.addEventListener('mousedown', onMouse, true)
    window.addEventListener('contextmenu', preventContext, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('mousedown', onMouse, true)
      window.removeEventListener('contextmenu', preventContext, true)
      void window.api.captureStop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return createPortal(
    <div className="capture-overlay" role="dialog" aria-modal="true" aria-label="Key capture">
      <div className="capture-overlay__text">
        <div className="capture-overlay__title">Press any key or mouse button</div>
        <div className="capture-overlay__sub">Esc to cancel</div>
      </div>
    </div>,
    document.body
  )
}

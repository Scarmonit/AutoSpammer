import React from 'react'
import { prettyBindingLabel } from '@shared/bindings'
import { useStore } from '../store'
import { CaptureButton } from './CaptureButton'

/**
 * Compact top-bar controls for the global Toggle and Emergency hotkeys (moved
 * here from the old "Toggle Hotkey" section). Each button shows the current
 * binding and, when clicked, listens for the next key/mouse button to rebind it.
 * The hotkeys themselves are registered globally in the main process, so they
 * keep working even while a game is focused — this only edits which key they use.
 */
export function TopBarHotkeys(): JSX.Element {
  const { data, assignBinding } = useStore()
  if (!data) return <></>
  const { toggleHotkey, emergencyHotkey } = data.settings

  return (
    <div className="topbar__hotkeys">
      <CaptureButton
        label={`Toggle: ${toggleHotkey ? prettyBindingLabel(toggleHotkey) : '—'}`}
        mode="accelerator"
        className="btn--ghost topbar__hotkey"
        onCapture={(accel) => void assignBinding('toggleHotkey', accel)}
      />
      <CaptureButton
        label={`Stop: ${emergencyHotkey ? prettyBindingLabel(emergencyHotkey) : '—'}`}
        mode="accelerator"
        className="btn--ghost topbar__hotkey"
        onCapture={(accel) => void assignBinding('emergencyHotkey', accel)}
      />
    </div>
  )
}

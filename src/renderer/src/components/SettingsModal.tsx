import React, { useEffect } from 'react'
import { prettyBindingLabel } from '@shared/bindings'
import { useStore } from '../store'
import { SectionToggle } from './SectionToggle'
import { CaptureButton } from './CaptureButton'
import { UiScaleControl } from './UiScaleControl'

interface Props {
  onClose: () => void
}

/** "Esc" reads better on a key chip than the full accelerator name. */
function keyLabel(accel: string): string {
  const label = accel ? prettyBindingLabel(accel) : '—'
  return label === 'Escape' ? 'Esc' : label
}

/** One Options row: title + one-line description on the left, control right. */
function OptRow({
  title,
  desc,
  children
}: {
  title: string
  desc: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="optrow">
      <div className="optrow__text">
        <div className="optrow__title">{title}</div>
        <div className="optrow__desc">{desc}</div>
      </div>
      <div className="optrow__ctl">{children}</div>
    </div>
  )
}

/**
 * App-wide Options dialog opened from the ⚙️ button in the top bar. Holds the
 * display toggles, the global hotkey bindings, the text-size control, the
 * tray behaviour, and the Reset layout action. Settings live in AppSettings
 * (global), not per profile.
 */
export function SettingsModal({ onClose }: Props): JSX.Element {
  const { data, updateSettings, assignBinding, resetSectionLayout } = useStore()
  const settings = data?.settings

  // Close on Escape, like a normal modal. (The key-capture overlay stops
  // propagation of its own Esc, so cancelling a capture keeps this open.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!settings) return <></>

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div
        className="modal modal--options"
        role="dialog"
        aria-modal="true"
        aria-label="Options"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal__head">
          <h2 className="modal__title">Options</h2>
          <button type="button" className="modal__close" aria-label="Close" title="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="modal__body">
          <div className="modal__group">Display</div>
          <OptRow title="Show hints" desc="One-line explanations under each section title.">
            <SectionToggle
              small
              checked={settings.showHints}
              onChange={(v) => void updateSettings({ showHints: v })}
              label="Show hints"
              title="Show the friendly descriptions under section titles"
            />
          </OptRow>
          <OptRow title="Show summary in toolbar" desc="Plain-English preview of what will run.">
            <SectionToggle
              small
              checked={settings.showSummaryBar}
              onChange={(v) => void updateSettings({ showSummaryBar: v })}
              label="Show summary in toolbar"
              title={'Show the "WHEN RUNNING" summary under the profile row'}
            />
          </OptRow>
          <OptRow title="Text size" desc="Scales the whole window.">
            <UiScaleControl icon={false} />
          </OptRow>

          <div className="modal__group">Hotkeys</div>
          <OptRow title="Start / stop" desc="Toggles the whole run from any window.">
            <CaptureButton
              label={keyLabel(settings.toggleHotkey)}
              mode="accelerator"
              className="keychip"
              onCapture={(accel) => void assignBinding('toggleHotkey', accel)}
            />
          </OptRow>
          <OptRow title="Emergency stop" desc="Always stops everything, even mid-run.">
            <CaptureButton
              label={keyLabel(settings.emergencyHotkey)}
              mode="accelerator"
              className="keychip"
              onCapture={(accel) => void assignBinding('emergencyHotkey', accel)}
            />
          </OptRow>

          <div className="modal__group">Window</div>
          <OptRow
            title="Minimize to tray on close"
            desc={
              settings.minimizeToTrayOnClose
                ? 'Closing the window keeps it running in the tray.'
                : 'Closing the window fully quits the app.'
            }
          >
            <SectionToggle
              small
              checked={settings.minimizeToTrayOnClose}
              onChange={(v) => void updateSettings({ minimizeToTrayOnClose: v })}
              label="Minimize to tray on close"
              title="Keep Auto Spammer (and its hotkeys) running in the tray when the window closes"
            />
          </OptRow>
        </div>

        <footer className="modal__foot modal__foot--split">
          <button
            type="button"
            className="btn btn--ghost"
            title="Restore the default section order"
            onClick={resetSectionLayout}
          >
            Reset layout
          </button>
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  )
}

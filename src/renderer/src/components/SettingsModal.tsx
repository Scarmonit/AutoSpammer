import React, { useEffect } from 'react'
import { useStore } from '../store'
import { SectionToggle } from './SectionToggle'

interface Props {
  onClose: () => void
}

/**
 * Small app-wide Options dialog opened from the ⚙️ button in the top bar.
 * Settings here live in AppSettings (global), not per profile.
 */
export function SettingsModal({ onClose }: Props): JSX.Element {
  const { data, updateSettings } = useStore()
  const settings = data?.settings

  // Close on Escape, like a normal modal.
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
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Options"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal__head">
          <h2 className="modal__title">⚙️ Options</h2>
          <button type="button" className="modal__close" aria-label="Close" title="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="modal__body">
          <div className="modal__group">Display</div>
          <div className="modal__switchrow">
            <span>Show hints</span>
            <SectionToggle
              small
              checked={settings.showHints}
              onChange={(v) => void updateSettings({ showHints: v })}
              label="Show hints"
              title="Show the friendly descriptions under section titles"
            />
          </div>
          <div className="modal__switchrow">
            <span>Show summary bar</span>
            <SectionToggle
              small
              checked={settings.showSummaryBar}
              onChange={(v) => void updateSettings({ showSummaryBar: v })}
              label="Show summary bar"
              title={'Show the "WHEN RUNNING" summary under the profile row'}
            />
          </div>

          <div className="modal__group">Window</div>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.minimizeToTrayOnClose}
              onChange={(e) => void updateSettings({ minimizeToTrayOnClose: e.target.checked })}
            />
            <span>Minimize to system tray when closing the window</span>
          </label>
          <p className="helper">
            When on, clicking the window's <strong>✕</strong> keeps Auto Spammer running in the system
            tray (global hotkeys stay active) — quit it from the tray's right-click menu. When off,
            closing the window <strong>fully quits</strong> the app.
          </p>
        </div>

        <footer className="modal__foot">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  )
}

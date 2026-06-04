import React from 'react'
import { useStore } from '../store'
import { Section } from './Section'
import { SectionToggle } from './SectionToggle'
import { CaptureButton } from './CaptureButton'
import { prettyName } from '../keycapture'

const isMouse = (k: string): boolean => k === 'mouse-left' || k === 'mouse-right'

export function HoldKeysPanel(): JSX.Element {
  const { data, activeProfile, aux, updateProfile, assignBinding, toggleHold } = useStore()
  if (!data || !activeProfile) return <></>

  const keys = activeProfile.holdKeys.keys
  const enabled = activeProfile.holdKeys.enabled
  const hotkey = data.settings.holdKeysHotkey

  const setKeys = (next: string[]): void =>
    updateProfile((p) => ({ ...p, holdKeys: { ...p.holdKeys, keys: next } }))

  const setEnabled = (value: boolean): void =>
    updateProfile((p) => ({ ...p, holdKeys: { ...p.holdKeys, enabled: value } }))

  // Add a mouse button (avoid duplicates — holding it twice is pointless).
  const addMouse = (button: 'mouse-left' | 'mouse-right'): void => {
    if (!keys.includes(button)) setKeys([...keys, button])
  }

  return (
    <Section
      title="Hold Keys Down"
      dim={!enabled}
      right={
        <SectionToggle
          checked={enabled}
          onChange={setEnabled}
          title="Hold these keys/buttons down while Start Spam (or F6) is running"
        />
      }
    >
      <p className="helper">
        Holds these keys <strong>or mouse buttons</strong> <strong>down</strong> (e.g. hold W to keep
        walking, or hold Left Click) — not tapped. When <strong>Enabled</strong>, they're held for the
        whole run alongside <strong>Start Spam</strong> / <strong>F6</strong>; you can also toggle them
        standalone with the button or <code className="keycap keycap--inline">{hotkey || '—'}</code>.
      </p>

      <div className="keylist">
        {keys.length === 0 && <p className="muted">No keys yet — add one below.</p>}
        {keys.map((k, i) =>
          isMouse(k) ? (
            <div className="keyrow" key={i}>
              <span className="keyrow__key keyrow__static">{prettyName(k)}</span>
              <button
                type="button"
                className="btn btn--icon btn--danger"
                title="Remove"
                onClick={() => setKeys(keys.filter((_, idx) => idx !== i))}
              >
                ×
              </button>
            </div>
          ) : (
            <div className="keyrow" key={i}>
              <input
                className="input keyrow__key"
                value={k}
                placeholder="key (e.g. w, space, shift)"
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => setKeys(keys.map((kk, idx) => (idx === i ? e.target.value : kk)))}
              />
              <button
                type="button"
                className="btn btn--icon btn--danger"
                title="Remove"
                onClick={() => setKeys(keys.filter((_, idx) => idx !== i))}
              >
                ×
              </button>
            </div>
          )
        )}
      </div>

      <div className="keylist__actions">
        <button type="button" className="btn btn--ghost" onClick={() => setKeys([...keys, ''])}>
          + Add Key
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => addMouse('mouse-left')}>
          + Left Click
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => addMouse('mouse-right')}>
          + Right Click
        </button>
        <button
          type="button"
          className={`btn ${aux.holdActive ? 'btn--danger' : 'btn--primary'}`}
          onClick={() => void toggleHold()}
        >
          {aux.holdActive ? '● Release' : 'Hold'}
        </button>
      </div>

      <div className="field" style={{ marginTop: 8 }}>
        <label>Toggle hotkey</label>
        <CaptureButton
          label={`Change (${hotkey || 'unset'})`}
          mode="accelerator"
          className="btn--ghost"
          onCapture={(accel) => void assignBinding('holdKeysHotkey', accel)}
        />
      </div>
    </Section>
  )
}

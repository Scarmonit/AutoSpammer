import React from 'react'
import { useStore } from '../store'
import { Section } from './Section'
import { CaptureButton } from './CaptureButton'

export function HoldKeysPanel(): JSX.Element {
  const { data, activeProfile, aux, updateProfile, assignBinding, toggleHold } = useStore()
  if (!data || !activeProfile) return <></>

  const keys = activeProfile.holdKeys.keys
  const hotkey = data.settings.holdKeysHotkey

  const setKeys = (next: string[]): void =>
    updateProfile((p) => ({ ...p, holdKeys: { keys: next } }))

  return (
    <Section title="Hold Keys Down">
      <p className="helper">
        Presses these keys <strong>down and keeps them held</strong> (e.g. hold W to keep walking) —
        not tapped. Toggle with the button or{' '}
        <code className="keycap keycap--inline">{hotkey || '—'}</code>.
      </p>

      <div className="keylist">
        {keys.length === 0 && <p className="muted">No keys yet — add one below.</p>}
        {keys.map((k, i) => (
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
        ))}
      </div>

      <div className="keylist__actions">
        <button type="button" className="btn btn--ghost" onClick={() => setKeys([...keys, ''])}>
          + Add Key
        </button>
        <button
          type="button"
          className={`btn ${aux.holdActive ? 'btn--danger' : 'btn--primary'}`}
          onClick={() => void toggleHold()}
        >
          {aux.holdActive ? '● Release Keys' : 'Hold Keys'}
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

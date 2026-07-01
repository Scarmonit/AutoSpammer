import React from 'react'
import { useStore } from '../store'
import { SectionToggle } from './SectionToggle'
import { prettyName } from '../keycapture'

const isMouse = (k: string): boolean => k === 'mouse-left' || k === 'mouse-right'

/** "Hold Keys" tab: keys/buttons held down for the whole run (formerly its own section). */
export function HoldKeysTab(): JSX.Element {
  const { activeProfile, updateProfile } = useStore()
  if (!activeProfile) return <></>

  const keys = activeProfile.holdKeys.keys
  const enabled = activeProfile.holdKeys.enabled

  const setKeys = (next: string[]): void =>
    updateProfile((p) => ({ ...p, holdKeys: { ...p.holdKeys, keys: next } }))

  const setEnabled = (value: boolean): void =>
    updateProfile((p) => ({ ...p, holdKeys: { ...p.holdKeys, enabled: value } }))

  // Add a mouse button (avoid duplicates — holding it twice is pointless).
  const addMouse = (button: 'mouse-left' | 'mouse-right'): void => {
    if (!keys.includes(button)) setKeys([...keys, button])
  }

  return (
    <div className="keystab">
      <div className="keystab__head">
        <SectionToggle
          checked={enabled}
          onChange={setEnabled}
          title="Hold these keys/buttons down while a run (F6) is active"
        />
      </div>

      <div className={`keystab__body${enabled ? '' : ' keystab__body--off'}`}>
        <p className="helper">
          Holds these keys <strong>or mouse buttons down</strong> (e.g. hold W to keep walking) — not
          tapped. When enabled they're held for the whole run.
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
        </div>
      </div>
    </div>
  )
}

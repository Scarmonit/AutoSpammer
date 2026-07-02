import React from 'react'
import { SECTION_ACCENTS } from '@shared/sections'
import { useStore } from '../store'
import { Section } from './Section'
import { SectionToggle } from './SectionToggle'
import { prettyName } from '../keycapture'

const isMouse = (k: string): boolean => k === 'mouse-left' || k === 'mouse-right'

/** "Hold keys down" card: keys/buttons physically held for the whole run. */
export function HoldKeysCard(): JSX.Element {
  const { activeProfile, updateProfile } = useStore()
  if (!activeProfile) return <></>

  const keys = activeProfile.holdKeys.keys
  const enabled = activeProfile.holdKeys.enabled

  const setKeys = (next: string[]): void =>
    updateProfile((p) => ({ ...p, holdKeys: { ...p.holdKeys, keys: next } }))

  const setEnabled = (value: boolean): void =>
    updateProfile((p) => ({ ...p, holdKeys: { ...p.holdKeys, enabled: value } }))

  // Quick-add chips toggle the mouse button in/out of the held list.
  const toggleMouse = (button: 'mouse-left' | 'mouse-right'): void => {
    if (keys.includes(button)) setKeys(keys.filter((k) => k !== button))
    else setKeys([...keys, button])
  }

  return (
    <Section
      title="Hold keys down"
      description="Held non-stop while running — e.g. hold W to keep walking."
      accent={SECTION_ACCENTS.holdKeys}
      dim={!enabled}
      right={
        <SectionToggle
          checked={enabled}
          onChange={setEnabled}
          title="Hold these keys/buttons down while running"
        />
      }
    >
      <div className="keylist">
        {keys.length === 0 && <p className="muted">No keys yet — add one below.</p>}
        {keys.map((k, i) =>
          isMouse(k) ? (
            <div className="keyrow" key={i}>
              <span className="keychip keychip--removable">
                {prettyName(k)}
                <button
                  type="button"
                  className="keychip__x"
                  title="Remove"
                  onClick={() => setKeys(keys.filter((_, idx) => idx !== i))}
                >
                  ×
                </button>
              </span>
            </div>
          ) : (
            <div className="keyrow" key={i}>
              <input
                className="keychip"
                value={k}
                placeholder="key (e.g. w, space, shift)"
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => setKeys(keys.map((kk, idx) => (idx === i ? e.target.value : kk)))}
              />
              <button
                type="button"
                className="rowx"
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
        <button type="button" className="chipbtn" onClick={() => setKeys([...keys, ''])}>
          + Add key
        </button>
        <button
          type="button"
          className={`chipbtn${keys.includes('mouse-left') ? ' chipbtn--on' : ''}`}
          title="Hold the left mouse button"
          onClick={() => toggleMouse('mouse-left')}
        >
          LMB
        </button>
        <button
          type="button"
          className={`chipbtn${keys.includes('mouse-right') ? ' chipbtn--on' : ''}`}
          title="Hold the right mouse button"
          onClick={() => toggleMouse('mouse-right')}
        >
          RMB
        </button>
      </div>
    </Section>
  )
}

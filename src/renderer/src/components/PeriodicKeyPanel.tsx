import React from 'react'
import type { PeriodicEntry } from '@shared/types'
import { makeId } from '@shared/defaults'
import { prettyBindingLabel } from '@shared/bindings'
import { useStore } from '../store'
import { Section } from './Section'
import { SectionToggle } from './SectionToggle'
import { CaptureButton } from './CaptureButton'
import { prettyName } from '../keycapture'

export function PeriodicKeyPanel(): JSX.Element {
  const { data, activeProfile, aux, updateProfile, assignBinding, togglePeriodic } = useStore()
  if (!data || !activeProfile) return <></>

  const pk = activeProfile.periodicKey
  const entries = pk.entries
  const hotkey = data.settings.periodicKeyHotkey

  const setEntries = (next: PeriodicEntry[]): void =>
    updateProfile((p) => ({ ...p, periodicKey: { ...p.periodicKey, entries: next } }))

  const addEntry = (): void =>
    setEntries([...entries, { id: makeId('pk'), key: '', intervalSec: 5 }])

  const patchEntry = (id: string, patch: Partial<PeriodicEntry>): void =>
    setEntries(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)))

  const removeEntry = (id: string): void => setEntries(entries.filter((e) => e.id !== id))

  const setEnabled = (value: boolean): void =>
    updateProfile((p) => ({ ...p, periodicKey: { ...p.periodicKey, enabled: value } }))

  return (
    <Section
      title="Periodic Key"
      dim={!pk.enabled}
      right={
        <SectionToggle
          checked={pk.enabled}
          onChange={setEnabled}
          title="Run these periodic presses while Start Spam (or F6) is running"
        />
      }
    >
      <p className="helper">
        Presses each key / mouse button on its <strong>own timer</strong> (e.g. F every 5s, MB4 every
        2s). When <strong>Enabled</strong>, they all run alongside <strong>Start Spam</strong> /{' '}
        <strong>F6</strong>; you can also run them standalone with the button or{' '}
        <code className="keycap keycap--inline">{hotkey ? prettyBindingLabel(hotkey) : '—'}</code>.
      </p>

      <div className="keylist">
        {entries.length === 0 && <p className="muted">No periodic keys yet — add one below.</p>}
        {entries.map((e) => (
          <div className="keyrow periodicrow" key={e.id}>
            <code className="keycap periodicrow__key">{prettyName(e.key)}</code>
            <CaptureButton
              label="Set Key"
              mode="name"
              className="btn--ghost periodicrow__set"
              onCapture={(name) => patchEntry(e.id, { key: name })}
            />
            <span className="keyrow__unit">every</span>
            <input
              className="input periodicrow__interval"
              type="number"
              min={0.1}
              step={0.1}
              value={e.intervalSec}
              onChange={(ev) =>
                patchEntry(e.id, { intervalSec: Math.max(0.1, Number(ev.target.value) || 0.1) })
              }
            />
            <span className="keyrow__unit">sec</span>
            <button
              type="button"
              className="btn btn--icon btn--danger"
              title="Remove"
              onClick={() => removeEntry(e.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="keylist__actions">
        <button type="button" className="btn btn--ghost" onClick={addEntry}>
          + Add Periodic Key
        </button>
        <button
          type="button"
          className={`btn ${aux.periodicActive ? 'btn--danger' : 'btn--primary'}`}
          onClick={() => void togglePeriodic()}
        >
          {aux.periodicActive ? '● Stop Periodic' : 'Start Periodic Press'}
        </button>
      </div>

      <div className="field" style={{ marginTop: 8 }}>
        <label>Toggle hotkey</label>
        <CaptureButton
          label={`Change (${hotkey ? prettyBindingLabel(hotkey) : 'unset'})`}
          mode="accelerator"
          className="btn--ghost"
          onCapture={(accel) => void assignBinding('periodicKeyHotkey', accel)}
        />
      </div>
    </Section>
  )
}

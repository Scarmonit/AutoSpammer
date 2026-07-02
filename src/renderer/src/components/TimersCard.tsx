import React from 'react'
import type { PeriodicEntry } from '@shared/types'
import { makeId } from '@shared/defaults'
import { SECTION_ACCENTS } from '@shared/sections'
import { useStore } from '../store'
import { Section } from './Section'
import { SectionToggle } from './SectionToggle'
import { CaptureButton } from './CaptureButton'
import { prettyName } from '../keycapture'

/** "Timers" card: keys/buttons pressed on their own schedules during a run. */
export function TimersCard(): JSX.Element {
  const { activeProfile, updateProfile } = useStore()
  if (!activeProfile) return <></>

  const pk = activeProfile.periodicKey
  const entries = pk.entries
  const enabled = pk.enabled

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
      title="Timers"
      description="Each key presses on its own schedule — runs alongside tapping."
      accent={SECTION_ACCENTS.timers}
      dim={!enabled}
      right={
        <SectionToggle
          checked={enabled}
          onChange={setEnabled}
          title="Run these timed presses while running"
        />
      }
    >
      <div className="keylist">
        {entries.length === 0 && <p className="muted">No timers yet — add one below.</p>}
        {entries.map((e) => (
          <div className="timerrow" key={e.id}>
            <span className="keyrow__label">Press</span>
            <CaptureButton
              label={prettyName(e.key)}
              mode="name"
              className="keychip"
              onCapture={(name) => patchEntry(e.id, { key: name })}
            />
            <span className="keyrow__label">every</span>
            <input
              className="input timerrow__interval"
              type="number"
              min={0.1}
              step={0.1}
              value={e.intervalSec}
              onChange={(ev) =>
                patchEntry(e.id, { intervalSec: Math.max(0.1, Number(ev.target.value) || 0.1) })
              }
            />
            <span className="keyrow__unit">sec</span>
            <span className="keyrow__spacer" />
            <button
              type="button"
              className="rowx"
              title="Remove"
              onClick={() => removeEntry(e.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="keylist__actions">
        <button type="button" className="chipbtn" onClick={addEntry}>
          + Add timer
        </button>
      </div>
    </Section>
  )
}

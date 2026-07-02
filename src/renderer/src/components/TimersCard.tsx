import React, { useEffect, useState } from 'react'
import type { PeriodicEntry } from '@shared/types'
import { makeId } from '@shared/defaults'
import { SECTION_ACCENTS } from '@shared/sections'
import { useStore } from '../store'
import { Section } from './Section'
import { SectionToggle } from './SectionToggle'
import { CaptureButton } from './CaptureButton'
import { prettyName } from '../keycapture'

interface IntervalProps {
  /** The last committed (valid) interval, in seconds. */
  value: number
  onCommit: (seconds: number) => void
  onError: (message: string) => void
}

/**
 * The "every [n] sec" field. The arrows step by whole seconds; decimals can
 * still be typed by hand. The value is validated when the field loses focus or
 * on Enter (not per keystroke, so it can be cleared while retyping): anything
 * empty, zero, or negative shows an error and reverts to the previous value.
 * Valid values commit immediately as they're typed/stepped.
 */
function IntervalField({ value, onCommit, onError }: IntervalProps): JSX.Element {
  const [draft, setDraft] = useState(String(value))
  const [focused, setFocused] = useState(false)

  // Track external changes (profile switch, etc.) — but never clobber an
  // in-progress edit (e.g. a trailing "2." while typing "2.5").
  useEffect(() => {
    if (!focused) setDraft(String(value))
  }, [value, focused])

  const parse = (text: string): number | null => {
    if (text.trim() === '') return null
    const n = Number(text)
    return Number.isFinite(n) && n > 0 ? n : null
  }

  const commit = (): void => {
    const n = parse(draft)
    if (n === null) {
      onError('Please enter a value greater than 0.')
      setDraft(String(value)) // revert to the previous valid value
      return
    }
    onCommit(n)
    setDraft(String(n))
  }

  return (
    <input
      className="input timerrow__interval"
      type="number"
      min={1}
      step={1}
      value={draft}
      onChange={(ev) => {
        const text = ev.target.value
        setDraft(text)
        // Valid values (incl. stepper clicks) apply live; invalid intermediate
        // states (empty while retyping) wait for blur/Enter to be validated.
        const n = parse(text)
        if (n !== null) onCommit(n)
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        commit()
      }}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur()
      }}
    />
  )
}

/** "Timed key presses" card: keys/buttons pressed on their own schedules during a run. */
export function TimersCard(): JSX.Element {
  const { activeProfile, updateProfile, showError } = useStore()
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
      title="Timed key presses"
      description="Presses each key repeatedly on its own schedule — runs alongside tapping."
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
        {entries.length === 0 && <p className="muted">No timed presses yet — add one below.</p>}
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
            <IntervalField
              value={e.intervalSec}
              onCommit={(seconds) => patchEntry(e.id, { intervalSec: seconds })}
              onError={showError}
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
        <button type="button" className="chipbtn chipbtn--accent" onClick={addEntry}>
          + Add timed press
        </button>
      </div>
    </Section>
  )
}

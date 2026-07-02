import React, { useRef } from 'react'
import type { SpamEntry } from '@shared/types'
import { makeId } from '@shared/defaults'
import { SECTION_ACCENTS } from '@shared/sections'
import { useStore } from '../store'
import { Section } from './Section'
import { SectionToggle } from './SectionToggle'
import { KeyRow } from './KeyRow'

/** "Tap keys" card: the key list, quick-add chips, and the tap options. */
export function TapKeysCard(): JSX.Element {
  const { activeProfile, updateProfile, patchOptions, recording, toggleRecording } = useStore()
  const dragFrom = useRef<number | null>(null)

  if (!activeProfile) return <></>
  const entries = activeProfile.entries
  const o = activeProfile.options
  const enabled = o.enableKeys

  const setEntries = (next: SpamEntry[]): void =>
    updateProfile((p) => ({ ...p, entries: next }))

  const addKey = (): void =>
    setEntries([...entries, { id: makeId('key'), kind: 'key', key: '', delayMs: null }])

  const patchAt = (index: number, patch: Partial<SpamEntry>): void =>
    setEntries(entries.map((e, i) => (i === index ? { ...e, ...patch } : e)))

  const deleteAt = (index: number): void => setEntries(entries.filter((_, i) => i !== index))

  const drop = (to: number): void => {
    const from = dragFrom.current
    dragFrom.current = null
    if (from === null || from === to) return
    const next = [...entries]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setEntries(next)
  }

  return (
    <Section
      title="Tap keys"
      description="Rapidly taps all of these, together, the whole time."
      accent={SECTION_ACCENTS.keys}
      dim={!enabled}
      right={
        <SectionToggle
          checked={enabled}
          onChange={(v) => patchOptions({ enableKeys: v })}
          title="Tap these keys while running"
        />
      }
    >
      <div className="keylist">
        {entries.length === 0 && <p className="muted">No keys yet — add one or record.</p>}
        {entries.map((entry, i) => (
          <KeyRow
            key={entry.id}
            entry={entry}
            index={i}
            onChange={(patch) => patchAt(i, patch)}
            onDelete={() => deleteAt(i)}
            onDragStart={() => (dragFrom.current = i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => drop(i)}
          />
        ))}
      </div>

      <div className="keylist__actions">
        <button type="button" className="chipbtn chipbtn--accent" onClick={addKey}>
          + Add key
        </button>
        <button
          type="button"
          className={`chipbtn${recording ? ' chipbtn--recording' : ''}`}
          title="Record keys/buttons pressed in another window"
          onClick={() => void toggleRecording()}
        >
          {recording ? '● Stop recording' : 'Record'}
        </button>
      </div>

      <div className="keylist__actions">
        <label className="check" title="Also tap the spacebar">
          <input
            type="checkbox"
            checked={o.spacebar}
            onChange={(e) => patchOptions({ spacebar: e.target.checked })}
          />
          <span>Space</span>
        </label>
        <label className="check" title="Also tap the left mouse button">
          <input
            type="checkbox"
            checked={o.leftClick}
            onChange={(e) => patchOptions({ leftClick: e.target.checked })}
          />
          <span>Left Click</span>
        </label>
        <label className="check" title="Also tap the right mouse button">
          <input
            type="checkbox"
            checked={o.rightClick}
            onChange={(e) => patchOptions({ rightClick: e.target.checked })}
          />
          <span>Right Click</span>
        </label>
      </div>
    </Section>
  )
}

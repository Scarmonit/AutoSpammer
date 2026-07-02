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
        <button type="button" className="chipbtn" onClick={addKey}>
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
        <button
          type="button"
          className={`chipbtn${o.spacebar ? ' chipbtn--on' : ''}`}
          title="Also tap the spacebar"
          onClick={() => patchOptions({ spacebar: !o.spacebar })}
        >
          Space
        </button>
        <button
          type="button"
          className={`chipbtn${o.leftClick ? ' chipbtn--on' : ''}`}
          title="Also tap the left mouse button"
          onClick={() => patchOptions({ leftClick: !o.leftClick })}
        >
          LMB
        </button>
        <button
          type="button"
          className={`chipbtn${o.rightClick ? ' chipbtn--on' : ''}`}
          title="Also tap the right mouse button"
          onClick={() => patchOptions({ rightClick: !o.rightClick })}
        >
          RMB
        </button>
      </div>

      <div className="optionrow">
        <span className="optionrow__label">Delay between taps</span>
        <input
          className="input keyrow__delay"
          type="number"
          min={0}
          value={o.defaultDelayMs}
          onChange={(e) =>
            patchOptions({ defaultDelayMs: Math.max(0, Number(e.target.value) || 0) })
          }
        />
        <span className="keyrow__unit">ms</span>
        <span className="optionrow__gap" />
        <span className="switchlabel">
          <SectionToggle
            small
            checked={o.sequenceMode}
            onChange={(v) => patchOptions({ sequenceMode: v })}
            label="One key at a time (sequence)"
            title="Fire the keys one at a time instead of all together"
          />
          <span>One key at a time (sequence)</span>
        </span>
      </div>
    </Section>
  )
}

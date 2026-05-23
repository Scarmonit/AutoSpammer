import React, { useRef } from 'react'
import type { SpamEntry } from '@shared/types'
import { makeId } from '@shared/defaults'
import { useStore } from '../store'
import { Section } from './Section'
import { KeyRow } from './KeyRow'

export function KeyList(): JSX.Element {
  const { activeProfile, updateProfile, recording, toggleRecording } = useStore()
  const dragFrom = useRef<number | null>(null)

  if (!activeProfile) return <></>
  const entries = activeProfile.entries

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
    <Section title="Keys to Spam">
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
        <button type="button" className="btn btn--ghost" onClick={addKey}>
          + Add Key
        </button>
        <button
          type="button"
          className={`btn ${recording ? 'btn--danger' : 'btn--ghost'}`}
          onClick={() => void toggleRecording()}
        >
          {recording ? '● Stop Recording' : 'Record'}
        </button>
      </div>
    </Section>
  )
}

import React, { useRef } from 'react'
import type { SpamEntry } from '@shared/types'
import { makeId } from '@shared/defaults'
import { useStore } from '../store'
import { Section } from './Section'
import { SectionToggle } from './SectionToggle'
import { KeyRow } from './KeyRow'
import { prettyName } from '../keycapture'

export function KeyList(): JSX.Element {
  const { activeProfile, updateProfile, patchOptions, recording, toggleRecording } = useStore()
  const dragFrom = useRef<number | null>(null)

  if (!activeProfile) return <></>
  const entries = activeProfile.entries
  const enabled = activeProfile.options.enableKeys

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

  // Always-visible, human-readable summary of everything that will be spammed.
  const o = activeProfile.options
  const tf = activeProfile.textFunction
  const summary: string[] = [
    ...(enabled
      ? [
          ...entries.map((e) =>
            e.kind === 'key' ? (e.key ? prettyName(e.key) : '(empty)') : prettyName(e.kind)
          ),
          ...(o.spacebar ? ['Spacebar'] : []),
          ...(o.leftClick ? ['Left Click'] : []),
          ...(o.rightClick ? ['Right Click'] : [])
        ]
      : []),
    ...(tf.enabled && tf.text ? [`"${tf.text}"`] : [])
  ]

  return (
    <Section
      title="Keys to Spam"
      dim={!enabled}
      right={
        <SectionToggle
          checked={enabled}
          onChange={(v) => patchOptions({ enableKeys: v })}
          title="Spam the keys in this list (and the Options spacebar/click toggles)"
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

      <div className="keylist__summary">
        <span className="keylist__summary-label">Will spam:</span>{' '}
        {summary.length > 0 ? (
          summary.map((s, i) => (
            <span key={i} className="chip">
              {s}
            </span>
          ))
        ) : (
          <span className="muted">nothing yet</span>
        )}
      </div>
    </Section>
  )
}

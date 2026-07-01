import React, { useRef } from 'react'
import type { SpamEntry } from '@shared/types'
import { makeId } from '@shared/defaults'
import { useStore } from '../store'
import { SectionToggle } from './SectionToggle'
import { KeyRow } from './KeyRow'
import { PeriodicTab } from './PeriodicTab'
import { prettyName } from '../keycapture'

/** "Spam Keys" tab: the key list, quick options, and live "Will spam" preview. */
export function SpamKeysTab(): JSX.Element {
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
    <div className="keystab">
      <div className="keystab__head">
        <SectionToggle
          checked={enabled}
          onChange={(v) => patchOptions({ enableKeys: v })}
          title="Spam the keys in this list (and the spacebar/click toggles below)"
        />
      </div>

      <div className={`keystab__body${enabled ? '' : ' keystab__body--off'}`}>
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

        {/* Quick options that ride along with the key list. */}
        <div className="keylist__options">
          <label className="check">
            <input
              type="checkbox"
              checked={o.spacebar}
              onChange={(e) => patchOptions({ spacebar: e.target.checked })}
            />
            <span>Spacebar</span>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={o.leftClick}
              onChange={(e) => patchOptions({ leftClick: e.target.checked })}
            />
            <span>Left Mouse Click</span>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={o.rightClick}
              onChange={(e) => patchOptions({ rightClick: e.target.checked })}
            />
            <span>Right Mouse Click</span>
          </label>

          <div className="field">
            <label>Default Delay</label>
            <div className="field__input">
              <input
                className="input"
                type="number"
                min={0}
                value={o.defaultDelayMs}
                onChange={(e) =>
                  patchOptions({ defaultDelayMs: Math.max(0, Number(e.target.value) || 0) })
                }
              />
              <span className="keyrow__unit">ms</span>
            </div>
          </div>

          <label className="check">
            <input
              type="checkbox"
              checked={o.sequenceMode}
              onChange={(e) => patchOptions({ sequenceMode: e.target.checked })}
            />
            <span>Sequence Mode (fire keys one at a time)</span>
          </label>
        </div>
      </div>

      {/* Periodic key presses — its own Enabled switch, independent of the
          spam-keys toggle above (so it isn't dimmed along with the key list). */}
      <div className="keystab__periodic">
        <PeriodicTab />
      </div>

      <div className={`keylist__summary${enabled ? '' : ' keystab__body--off'}`}>
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
    </div>
  )
}

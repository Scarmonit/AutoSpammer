import React from 'react'
import type { SpamEntry } from '@shared/types'
import { prettyName } from '../keycapture'

interface Props {
  entry: SpamEntry
  index: number
  onChange: (patch: Partial<SpamEntry>) => void
  onDelete: () => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
}

/** One tap-key row: chip-style key on the left, its delay + remove on the right. */
export function KeyRow({
  entry,
  onChange,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop
}: Props): JSX.Element {
  const isMouse = entry.kind !== 'key'

  return (
    <div className="keyrow" onDragOver={onDragOver} onDrop={onDrop}>
      {/* Only the grip is draggable — making the whole row draggable blocks
          focus/typing in the inputs (a Chromium quirk). */}
      <span
        className="keyrow__grip"
        title="Drag to reorder"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', '')
          onDragStart()
        }}
      >
        ⋮⋮
      </span>

      {isMouse ? (
        <span className="keychip">{prettyName(entry.key || entry.kind)}</span>
      ) : (
        <input
          className="keychip"
          value={entry.key}
          placeholder="key (e.g. a, space, f6)"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          onChange={(e) => onChange({ key: e.target.value })}
        />
      )}

      <span className="keyrow__spacer" />
      <span className="keyrow__label">delay</span>
      <input
        className="input keyrow__delay"
        type="number"
        min={0}
        value={entry.delayMs ?? ''}
        placeholder="default"
        onChange={(e) => {
          const v = e.target.value
          onChange({ delayMs: v === '' ? null : Math.max(0, Number(v) || 0) })
        }}
      />
      <span className="keyrow__unit">ms</span>

      <button type="button" className="rowx" title="Remove" onClick={onDelete}>
        ×
      </button>
    </div>
  )
}

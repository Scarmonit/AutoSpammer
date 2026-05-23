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
    <div className="keyrow" draggable onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
      <span className="keyrow__grip" title="Drag to reorder">⋮⋮</span>

      {isMouse ? (
        <span className="keyrow__mouse">{prettyName(entry.key || entry.kind)}</span>
      ) : (
        <input
          className="input keyrow__key"
          value={entry.key}
          placeholder="key"
          spellCheck={false}
          onChange={(e) => onChange({ key: e.target.value })}
        />
      )}

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

      <button type="button" className="btn btn--icon btn--danger" title="Remove" onClick={onDelete}>
        ×
      </button>
    </div>
  )
}

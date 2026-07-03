import React, { useState } from 'react'
import { useStore } from '../store'

const MIN_PCT = 100
const MAX_PCT = 200
/** Dropdown presets: 100%, 105%, … 200%. */
const PRESETS = Array.from({ length: (MAX_PCT - MIN_PCT) / 5 + 1 }, (_, i) => MIN_PCT + i * 5)

const clampPct = (n: number): number => Math.min(MAX_PCT, Math.max(MIN_PCT, Math.round(n)))

/**
 * Whole-window UI scale (zoom) control, shown in the Options dialog. Pick a
 * preset from the dropdown, or double-click it to type any custom value
 * between 100% and 200%. Applies immediately and is saved globally.
 */
export function UiScaleControl({ icon = true }: { icon?: boolean }): JSX.Element {
  const { data, setUiScale } = useStore()
  const [editing, setEditing] = useState(false)
  if (!data) return <></>

  const pct = clampPct((data.settings.uiScale ?? 1) * 100)
  const apply = (value: number): void => void setUiScale(clampPct(value) / 100)

  // Show the exact value in the dropdown even when it isn't a 5%-step preset.
  const options = PRESETS.includes(pct) ? PRESETS : [pct, ...PRESETS].sort((a, b) => a - b)

  return (
    <div
      className="uiscale"
      title="Text / UI size — double-click to type a custom %"
      onDoubleClick={() => setEditing(true)}
    >
      {icon && (
        <span className="uiscale__icon" aria-hidden="true">
          A
        </span>
      )}
      {editing ? (
        <input
          className="input uiscale__input"
          type="number"
          min={MIN_PCT}
          max={MAX_PCT}
          step={1}
          autoFocus
          defaultValue={pct}
          aria-label="UI scale percent"
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              apply(Number((e.target as HTMLInputElement).value) || pct)
              setEditing(false)
            } else if (e.key === 'Escape') {
              // Cancel only this edit — don't let the Escape bubble up and
              // close the Options dialog around it.
              e.stopPropagation()
              setEditing(false)
            }
          }}
          onBlur={(e) => {
            apply(Number(e.target.value) || pct)
            setEditing(false)
          }}
        />
      ) : (
        <select
          className="uiscale__select"
          value={pct}
          aria-label="UI scale"
          onChange={(e) => apply(Number(e.target.value))}
        >
          {options.map((p) => (
            <option key={p} value={p}>
              {p}%
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

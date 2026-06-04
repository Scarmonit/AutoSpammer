import React from 'react'
import { useStore } from '../store'

const MIN_PCT = 100
const MAX_PCT = 200
const STEP_PCT = 5

/**
 * Compact top-bar slider that scales the whole window (text, padding, buttons)
 * via the renderer's zoom factor. Saved globally and applied immediately.
 */
export function UiScaleControl(): JSX.Element {
  const { data, setUiScale } = useStore()
  if (!data) return <></>

  const pct = Math.round((data.settings.uiScale ?? 1) * 100)

  return (
    <div className="uiscale" title="Text / UI size">
      <span className="uiscale__icon" aria-hidden="true">
        A
      </span>
      <input
        className="uiscale__slider"
        type="range"
        min={MIN_PCT}
        max={MAX_PCT}
        step={STEP_PCT}
        value={pct}
        aria-label="UI scale"
        onChange={(e) => void setUiScale(Number(e.target.value) / 100)}
      />
      <span className="uiscale__label">{pct}%</span>
    </div>
  )
}

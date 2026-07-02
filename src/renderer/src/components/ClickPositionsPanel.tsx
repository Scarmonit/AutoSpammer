import React from 'react'
import type { ClickPosition } from '@shared/types'
import { prettyBindingLabel } from '@shared/bindings'
import { SECTION_ACCENTS } from '@shared/sections'
import { useStore } from '../store'
import { Section } from './Section'
import { SectionToggle } from './SectionToggle'
import { CaptureButton } from './CaptureButton'

export function ClickPositionsPanel(): JSX.Element {
  const {
    data,
    activeProfile,
    updateProfile,
    assignBinding,
    patchOptions,
    addCurrentPosition,
    recordingPositions,
    toggleRecordingPositions
  } = useStore()
  if (!data || !activeProfile) return <></>

  const positions = activeProfile.clickPositions
  const recordHotkey = data.settings.recordPositionHotkey
  const enabled = activeProfile.options.enableClickPositions

  const setPositions = (next: ClickPosition[]): void =>
    updateProfile((p) => ({ ...p, clickPositions: next }))

  const patchAt = (i: number, patch: Partial<ClickPosition>): void =>
    setPositions(positions.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))

  const removeAt = (i: number): void => setPositions(positions.filter((_, idx) => idx !== i))

  return (
    <Section
      title="Click positions"
      description="Clicks these saved screen spots, in order, on repeat."
      accent={SECTION_ACCENTS.clickPositions}
      dim={!enabled}
      right={
        <SectionToggle
          checked={enabled}
          onChange={(v) => patchOptions({ enableClickPositions: v })}
          title="Click the recorded positions while spamming"
        />
      }
    >
      <p className="helper hint">
        Aim your mouse at a spot and press{' '}
        <code className="keycap keycap--inline">
          {recordHotkey ? prettyBindingLabel(recordHotkey) : '—'}
        </code>{' '}
        to record it — works even while a game is focused. Or hit <strong>Record clicks</strong> and every
        left/right click you make is saved automatically.
      </p>

      <div className="field">
        <label>Record hotkey</label>
        <CaptureButton
          label={`Change (${recordHotkey ? prettyBindingLabel(recordHotkey) : 'unset'})`}
          mode="accelerator"
          className="btn--ghost"
          onCapture={(accel) => void assignBinding('recordPositionHotkey', accel)}
        />
      </div>

      <div className="poslist">
        {positions.length === 0 && <p className="muted">No positions saved yet.</p>}
        {positions.map((p, i) => (
          <div className="posrow" key={p.id}>
            <span className="posrow__idx">{i + 1}</span>
            <button
              type="button"
              className="btn btn--ghost posrow__btn"
              title="Toggle left/right click"
              onClick={() => patchAt(i, { button: p.button === 'left' ? 'right' : 'left' })}
            >
              {p.button === 'left' ? 'L' : 'R'}
            </button>
            <span className="posrow__xy">
              ({p.x}, {p.y})
            </span>
            <input
              className="input posrow__delay"
              type="number"
              min={0}
              value={p.delayMs ?? ''}
              placeholder="default"
              onChange={(e) => {
                const v = e.target.value
                patchAt(i, { delayMs: v === '' ? null : Math.max(0, Number(v) || 0) })
              }}
            />
            <span className="keyrow__unit">ms</span>
            <button
              type="button"
              className="btn btn--icon btn--danger"
              title="Remove"
              onClick={() => removeAt(i)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="keylist__actions">
        <button
          type="button"
          className="chipbtn"
          title="Save the current mouse position"
          disabled={recordingPositions}
          onClick={() => void addCurrentPosition()}
        >
          + Add position
        </button>
        <button
          type="button"
          className={`chipbtn${recordingPositions ? ' chipbtn--recording' : ''}`}
          title="Record every left/right click as a new position"
          onClick={() => void toggleRecordingPositions()}
        >
          {recordingPositions ? '■ Stop recording' : '● Record clicks'}
        </button>
        <button
          type="button"
          className="chipbtn"
          disabled={positions.length === 0}
          onClick={() => setPositions([])}
        >
          Clear
        </button>
      </div>
    </Section>
  )
}

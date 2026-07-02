import React from 'react'
import type { MacroEvent } from '@shared/types'
import { prettyBindingLabel } from '@shared/bindings'
import { SECTION_ACCENTS } from '@shared/sections'
import { useStore } from '../store'
import { Section } from './Section'
import { SectionToggle } from './SectionToggle'
import { CaptureButton } from './CaptureButton'
import { prettyName } from '../keycapture'

function buttonLabel(b?: 'left' | 'right' | 'middle'): string {
  if (b === 'right') return 'Right click'
  if (b === 'middle') return 'Middle click'
  return 'Left click'
}

/** Human-readable summary of a single recorded event. */
function describe(ev: MacroEvent): string {
  switch (ev.type) {
    case 'key-down':
      return `${prettyName(ev.key ?? '')} ↓`
    case 'key-up':
      return `${prettyName(ev.key ?? '')} ↑`
    case 'mouse-down':
      return `${buttonLabel(ev.button)} ↓ (${ev.x}, ${ev.y})`
    case 'mouse-up':
      return `${buttonLabel(ev.button)} ↑ (${ev.x}, ${ev.y})`
    case 'mouse-move':
      return `Move → (${ev.x}, ${ev.y})`
  }
}

export function MacroPanel(): JSX.Element {
  const {
    data,
    activeProfile,
    status,
    assignBinding,
    macroRecording,
    macroPlaying,
    toggleMacroRecording,
    setMacroEnabled,
    playMacro,
    stopMacro,
    clearMacro,
    setMacroEventDelay,
    saveNow
  } = useStore()

  if (!data || !activeProfile) return <></>

  const macro = activeProfile.macro
  const events = macro.events
  const recordHotkey = data.settings.macroRecordHotkey
  const spamming = status.status === 'running'

  return (
    <Section
      title="Macro"
      description="Record a series of clicks & keys, then replay it on loop."
      accent={SECTION_ACCENTS.macro}
      dim={!macro.enabled}
      right={
        <SectionToggle
          checked={macro.enabled}
          onChange={(v) => setMacroEnabled(v)}
          title="Use the macro (turns off Tap keys and Click positions)"
        />
      }
    >
      <p className="helper hint">
        Records <strong>everything</strong> — keys, clicks, and mouse movement with exact timing.
        Enabling Macro turns off Tap keys and Click positions (and vice-versa). When enabled, your{' '}
        <strong>Toggle Hotkey</strong> (F6) plays it on a loop per your <strong>Loop</strong> setting;{' '}
        <strong>Play</strong> below is a one-shot preview.
      </p>

      <div className="keylist__actions">
        <button
          type="button"
          className={`chipbtn${macroRecording ? ' chipbtn--recording' : ''}`}
          disabled={macroPlaying}
          onClick={() => void toggleMacroRecording()}
        >
          {macroRecording ? '■ Stop recording' : '● Record'}
        </button>
        <CaptureButton
          label={`Record hotkey (${recordHotkey ? prettyBindingLabel(recordHotkey) : 'unset'})`}
          mode="accelerator"
          className="btn--ghost"
          onCapture={(accel) => void assignBinding('macroRecordHotkey', accel)}
        />
      </div>

      <div className="poslist macro__list">
        {events.length === 0 && <p className="muted">No macro recorded yet.</p>}
        {events.map((ev, i) => (
          <div className="macrorow" key={ev.id}>
            <span className="posrow__idx">{i + 1}</span>
            <span className="macrorow__wait">
              wait
              <input
                className="input macrorow__delay"
                type="number"
                min={0}
                value={ev.delayMs}
                title="Delay before this event (ms)"
                onChange={(e) => setMacroEventDelay(ev.id, Math.max(0, Number(e.target.value) || 0))}
              />
              ms
            </span>
            <span className="macrorow__desc">{describe(ev)}</span>
          </div>
        ))}
      </div>

      <div className="keylist__actions">
        <button
          type="button"
          className="btn btn--primary"
          title="Play the macro once (preview). Use your Toggle Hotkey (F6) to loop it."
          disabled={events.length === 0 || macroRecording || macroPlaying || spamming}
          onClick={() => void playMacro()}
        >
          ▶ Play once
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={!macroPlaying}
          onClick={() => void stopMacro()}
        >
          ■ Stop
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={events.length === 0 || macroRecording || macroPlaying}
          onClick={() => clearMacro()}
        >
          Clear
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => void saveNow()}>
          Save
        </button>
      </div>

      {events.length > 0 && (
        <p className="muted macro__count">
          {events.length} event{events.length === 1 ? '' : 's'}
        </p>
      )}
    </Section>
  )
}

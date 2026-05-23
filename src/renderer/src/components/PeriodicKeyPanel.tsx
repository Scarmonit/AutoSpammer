import React from 'react'
import { useStore } from '../store'
import { Section } from './Section'
import { CaptureButton } from './CaptureButton'

export function PeriodicKeyPanel(): JSX.Element {
  const { data, activeProfile, aux, updateProfile, updateSettings, togglePeriodic } = useStore()
  if (!data || !activeProfile) return <></>

  const pk = activeProfile.periodicKey
  const hotkey = data.settings.periodicKeyHotkey

  const patch = (p: Partial<typeof pk>): void =>
    updateProfile((prof) => ({ ...prof, periodicKey: { ...prof.periodicKey, ...p } }))

  return (
    <Section title="Periodic Key">
      <p className="helper">
        Presses one key on a timer (e.g. press F every few seconds). Toggle with the button or{' '}
        <code className="keycap keycap--inline">{hotkey || '—'}</code>.
      </p>

      <div className="field">
        <label>Key</label>
        <input
          className="input input--mini"
          value={pk.key}
          placeholder="key"
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => patch({ key: e.target.value })}
        />
      </div>

      <div className="field">
        <label>Every</label>
        <div className="field__input">
          <input
            className="input"
            type="number"
            min={0.1}
            step={0.1}
            value={pk.intervalSec}
            onChange={(e) => patch({ intervalSec: Math.max(0.1, Number(e.target.value) || 0.1) })}
          />
          <span className="keyrow__unit">sec</span>
        </div>
      </div>

      <button
        type="button"
        className={`btn ${aux.periodicActive ? 'btn--danger' : 'btn--primary'}`}
        style={{ width: '100%' }}
        onClick={() => void togglePeriodic()}
      >
        {aux.periodicActive ? '● Stop Periodic Press' : 'Start Periodic Press'}
      </button>

      <div className="field" style={{ marginTop: 8 }}>
        <label>Toggle hotkey</label>
        <CaptureButton
          label={`Change (${hotkey || 'unset'})`}
          mode="accelerator"
          className="btn--ghost"
          onCapture={(accel) => void updateSettings({ periodicKeyHotkey: accel })}
        />
      </div>
    </Section>
  )
}

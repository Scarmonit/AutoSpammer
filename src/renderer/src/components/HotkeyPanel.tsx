import React from 'react'
import { useStore } from '../store'
import { Section } from './Section'
import { CaptureButton } from './CaptureButton'

export function HotkeyPanel(): JSX.Element {
  const { data, updateSettings } = useStore()
  if (!data) return <></>

  return (
    <Section title="Toggle Hotkey">
      <div className="field">
        <label>Current</label>
        <code className="keycap">{data.settings.toggleHotkey || '—'}</code>
      </div>
      <CaptureButton
        label="Change Key"
        mode="accelerator"
        className="btn--ghost"
        onCapture={(accel) => void updateSettings({ toggleHotkey: accel })}
      />
      <p className="helper">Starts / stops spamming even when this window is unfocused.</p>

      <div className="field" style={{ marginTop: 8 }}>
        <label>Emergency</label>
        <code className="keycap">{data.settings.emergencyHotkey || '—'}</code>
      </div>
      <CaptureButton
        label="Change Emergency Key"
        mode="accelerator"
        className="btn--ghost"
        onCapture={(accel) => void updateSettings({ emergencyHotkey: accel })}
      />
      <p className="helper">Instantly stops spamming while it is running.</p>
    </Section>
  )
}

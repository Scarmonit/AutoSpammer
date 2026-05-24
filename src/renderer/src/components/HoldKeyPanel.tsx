import React from 'react'
import type { HoldConfig } from '@shared/types'
import { useStore } from '../store'
import { Section } from './Section'
import { CaptureButton } from './CaptureButton'
import { prettyName } from '../keycapture'

interface Props {
  field: 'holdToSpam' | 'focusHold' | 'rightClickHold'
  title: string
  helper: string
}

export function HoldKeyPanel({ field, title, helper }: Props): JSX.Element {
  const { activeProfile, updateProfile } = useStore()
  if (!activeProfile) return <></>
  const cfg: HoldConfig = activeProfile[field]

  const patch = (p: Partial<HoldConfig>): void =>
    updateProfile((prof) => ({ ...prof, [field]: { ...prof[field], ...p } }))

  return (
    <Section title={title}>
      <label className="check">
        <input type="checkbox" checked={cfg.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
        <span>Enable</span>
      </label>

      <div className="field">
        <label>Key</label>
        <code className="keycap">{prettyName(cfg.key)}</code>
      </div>

      <CaptureButton
        label="Set Key"
        mode="name"
        allowMouse
        className="btn--ghost"
        onCapture={(name) => patch({ key: name })}
      />

      <div className="field" style={{ marginTop: 8 }}>
        <label>Delay</label>
        <div className="field__input">
          <input
            className="input"
            type="number"
            min={1}
            value={cfg.delayMs}
            onChange={(e) => patch({ delayMs: Math.max(1, Number(e.target.value) || 1) })}
          />
          <span className="keyrow__unit">ms</span>
        </div>
      </div>

      <p className="helper">{helper}</p>
    </Section>
  )
}

import React from 'react'
import type { HoldConfig } from '@shared/types'
import { useStore } from '../store'
import { SectionToggle } from './SectionToggle'
import { CaptureButton } from './CaptureButton'
import { prettyName } from '../keycapture'
import { HoldKeysTab } from './HoldKeysTab'

type HoldField = 'holdToSpam' | 'focusHold' | 'rightClickHold'

interface ModeDef {
  field: HoldField
  title: string
  desc: string
}

const MODES: ModeDef[] = [
  {
    field: 'holdToSpam',
    title: 'Hold-to-Spam',
    desc: 'Hold the key to run your whole spam list — release to stop.'
  },
  {
    field: 'focusHold',
    title: 'Focus Hold',
    desc: 'Hold to rapidly fire only that one key or button.'
  },
  {
    field: 'rightClickHold',
    title: 'Hold for Right-Click',
    desc: 'Hold to rapidly right-click — release to stop.'
  }
]

/** One hold-trigger mode, laid out as a compact card. */
function HoldModeCard({ field, title, desc }: ModeDef): JSX.Element {
  const { activeProfile, updateProfile, assignBinding } = useStore()
  if (!activeProfile) return <></>
  const cfg: HoldConfig = activeProfile[field]

  const patch = (p: Partial<HoldConfig>): void =>
    updateProfile((prof) => ({ ...prof, [field]: { ...prof[field], ...p } }))

  return (
    <div className="holdmode holdmode--card">
      <div className="holdmode__head">
        <span className="holdmode__title">{title}</span>
        <SectionToggle
          checked={cfg.enabled}
          onChange={(v) => patch({ enabled: v })}
          title={`Enable ${title} — hold its key/button to trigger it`}
        />
      </div>
      <p className="holdmode__desc">{desc}</p>
      <div className="field">
        <label>Key</label>
        <div className="holdmode__keyset">
          <code className="keycap">{prettyName(cfg.key)}</code>
          <CaptureButton
            label="Set Key"
            mode="name"
            className="btn--ghost subbar__btn"
            onCapture={(name) => void assignBinding(field, name)}
          />
        </div>
      </div>
      <div className="field">
        <label>Delay</label>
        <div className="field__input">
          <input
            className="input input--mini"
            type="number"
            min={1}
            value={cfg.delayMs}
            onChange={(e) => patch({ delayMs: Math.max(1, Number(e.target.value) || 1) })}
          />
          <span className="keyrow__unit">ms</span>
        </div>
      </div>
    </div>
  )
}

/**
 * "Hold Actions" sub-section: the Hold Keys Down list (keys/buttons held down for
 * the whole run) plus the three hold-trigger modes, each clearly laid out.
 */
export function HoldActionsGroup(): JSX.Element {
  return (
    <div className="holdactions">
      <div className="holdactions__block">
        <div className="holdactions__label">Hold Keys Down</div>
        <HoldKeysTab />
      </div>

      <div className="holdactions__block">
        <div className="holdactions__label">Hold Triggers</div>
        <div className="holdmodes">
          {MODES.map((m) => (
            <HoldModeCard key={m.field} {...m} />
          ))}
        </div>
      </div>
    </div>
  )
}

import React from 'react'
import type { HoldConfig } from '@shared/types'
import { useStore } from '../store'
import { Section } from './Section'
import { SectionToggle } from './SectionToggle'
import { CaptureButton } from './CaptureButton'
import { prettyName } from '../keycapture'

type HoldField = 'holdToSpam' | 'focusHold' | 'rightClickHold'

interface CardProps {
  field: HoldField
  title: string
  helper: string
}

/** One hold mode rendered as a self-contained card inside the Hold Modes section. */
function HoldModeCard({ field, title, helper }: CardProps): JSX.Element {
  const { activeProfile, updateProfile, assignBinding } = useStore()
  if (!activeProfile) return <></>
  const cfg: HoldConfig = activeProfile[field]

  const patch = (p: Partial<HoldConfig>): void =>
    updateProfile((prof) => ({ ...prof, [field]: { ...prof[field], ...p } }))

  return (
    <div className="holdmode">
      <div className="holdmode__head">
        <span className="holdmode__title">{title}</span>
        <SectionToggle
          checked={cfg.enabled}
          onChange={(value) => patch({ enabled: value })}
          title={`Enable ${title} — hold the set key/button to trigger it`}
        />
      </div>

      <div className={`holdmode__body${cfg.enabled ? '' : ' holdmode__body--off'}`}>
        <p className="helper">{helper}</p>

        <div className="holdmode__row">
          <div className="field">
            <label>Key</label>
            <code className="keycap">{prettyName(cfg.key)}</code>
          </div>
          <CaptureButton
            label="Set Key"
            mode="name"
            className="btn--ghost"
            onCapture={(name) => void assignBinding(field, name)}
          />
        </div>

        <div className="field">
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
      </div>
    </div>
  )
}

/**
 * Hold Modes: the three "hold a key to do X" triggers grouped into one section.
 * Each mode keeps its own enable switch, key binding, delay, and behaviour:
 *   - Hold-to-Spam Key: runs the whole spam system while held.
 *   - Focus Hold Key: rapidly fires only that key/button.
 *   - Hold for Right-Click: rapidly right-clicks while held.
 */
export function HoldModesPanel(): JSX.Element {
  return (
    <Section title="Hold Modes">
      <p className="helper">
        Three independent hold triggers — enable any combination. Each fires while you physically
        hold its key or mouse button and stops the moment you release.
      </p>

      <div className="holdmodes">
        <HoldModeCard
          field="holdToSpam"
          title="Hold-to-Spam Key"
          helper="Hold the key to spam your whole list, release to stop."
        />
        <HoldModeCard
          field="focusHold"
          title="Focus Hold Key"
          helper="Hold to rapidly fire ONLY this key/button itself."
        />
        <HoldModeCard
          field="rightClickHold"
          title="Hold for Right-Click"
          helper="Hold the set key/button to rapidly RIGHT-CLICK; release to stop."
        />
      </div>
    </Section>
  )
}

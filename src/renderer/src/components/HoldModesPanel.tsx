import React, { useState } from 'react'
import type { HoldConfig } from '@shared/types'
import { useStore } from '../store'
import { Section } from './Section'
import { SectionToggle } from './SectionToggle'
import { CaptureButton } from './CaptureButton'
import { prettyName } from '../keycapture'

type HoldField = 'holdToSpam' | 'focusHold' | 'rightClickHold'

interface ModeDef {
  field: HoldField
  /** Short tab label. */
  tab: string
  /** Full name. */
  title: string
  /** One-line plain-English description. */
  desc: string
}

const MODES: ModeDef[] = [
  {
    field: 'holdToSpam',
    tab: 'Hold-to-Spam',
    title: 'Hold-to-Spam',
    desc: 'Hold the key to run your whole spam list — release to stop.'
  },
  {
    field: 'focusHold',
    tab: 'Focus Hold',
    title: 'Focus Hold',
    desc: 'Hold to rapidly fire only that one key or button.'
  },
  {
    field: 'rightClickHold',
    tab: 'Right-Click',
    title: 'Right-Click Hold',
    desc: 'Hold to rapidly right-click — release to stop.'
  }
]

/**
 * Hold Modes: the three "hold a key to do X" triggers, shown one at a time via
 * tabs to keep the section compact. Each mode keeps its own Enable switch, key
 * binding, delay, and behaviour — only the layout changed. A small dot marks
 * tabs whose mode is currently enabled, so the armed modes are visible at a
 * glance even when another tab is selected.
 */
export function HoldModesPanel(): JSX.Element {
  const { activeProfile, updateProfile, assignBinding } = useStore()
  const [active, setActive] = useState<HoldField>('holdToSpam')
  if (!activeProfile) return <></>

  const mode = MODES.find((m) => m.field === active) ?? MODES[0]
  const cfg: HoldConfig = activeProfile[active]

  const patch = (p: Partial<HoldConfig>): void =>
    updateProfile((prof) => ({ ...prof, [active]: { ...prof[active], ...p } }))

  return (
    <Section title="Hold Modes">
      <div className="holdtabs" role="tablist" aria-label="Hold modes">
        {MODES.map((m) => {
          const on = activeProfile[m.field].enabled
          const isActive = m.field === active
          return (
            <button
              key={m.field}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`holdtab${isActive ? ' holdtab--active' : ''}${on ? ' holdtab--on' : ''}`}
              title={on ? `${m.title} — enabled` : m.title}
              onClick={() => setActive(m.field)}
            >
              {on && <span className="holdtab__dot" aria-hidden="true" />}
              {m.tab}
            </button>
          )
        })}
      </div>

      <div className="holdmode" role="tabpanel">
        <p className="holdmode__desc">{mode.desc}</p>

        <SectionToggle
          checked={cfg.enabled}
          onChange={(v) => patch({ enabled: v })}
          title={`Enable ${mode.title} — hold its key/button to trigger it`}
        />

        <div className="field">
          <label>Key</label>
          <div className="holdmode__keyset">
            <code className="keycap">{prettyName(cfg.key)}</code>
            <CaptureButton
              label="Set Key"
              mode="name"
              className="btn--ghost subbar__btn"
              onCapture={(name) => void assignBinding(active, name)}
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
    </Section>
  )
}

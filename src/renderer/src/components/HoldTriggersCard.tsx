import React from 'react'
import type { HoldConfig } from '@shared/types'
import { SECTION_ACCENTS } from '@shared/sections'
import { useStore } from '../store'
import { Section } from './Section'
import { SectionToggle } from './SectionToggle'
import { CaptureButton } from './CaptureButton'
import { prettyName } from '../keycapture'

type TriggerField = 'holdToSpam' | 'focusHold' | 'rightClickHold'

interface TriggerDef {
  field: TriggerField
  title: string
  desc: string
}

const TRIGGERS: TriggerDef[] = [
  {
    field: 'holdToSpam',
    title: 'Hold to spam everything',
    desc: 'While held, runs your whole tap list. Release to stop.'
  },
  {
    field: 'focusHold',
    title: 'Hold to rapid-fire one key',
    desc: 'While held, fires just this key as fast as the delay allows.'
  },
  {
    field: 'rightClickHold',
    title: 'Hold to rapid right-click',
    desc: 'While held, right-clicks over and over.'
  }
]

/** One trigger row: its own small switch, name + hint, and the key/delay line. */
function TriggerRow({ field, title, desc }: TriggerDef): JSX.Element {
  const { data, activeProfile, updateProfile, assignBinding } = useStore()
  if (!activeProfile) return <></>
  const cfg: HoldConfig = activeProfile[field]
  const showHints = data?.settings.showHints !== false

  const patch = (p: Partial<HoldConfig>): void =>
    updateProfile((prof) => ({ ...prof, [field]: { ...prof[field], ...p } }))

  return (
    <div className={`trigrow${cfg.enabled ? '' : ' trigrow--off'}`}>
      <span className="trigrow__switch">
        <SectionToggle
          small
          checked={cfg.enabled}
          onChange={(v) => patch({ enabled: v })}
          label={title}
          title={`Enable "${title}" — hold its key/button to trigger it`}
        />
      </span>
      <div className="trigrow__main">
        <div>
          <div className="trigrow__title">{title}</div>
          {showHints && <p className="trigrow__desc hint">{desc}</p>}
        </div>
        <div className="trigrow__inline">
          <span className="keyrow__label">Hold</span>
          <CaptureButton
            label={prettyName(cfg.key)}
            mode="name"
            className="keychip"
            onCapture={(name) => void assignBinding(field, name)}
          />
          <span className="keyrow__label">delay</span>
          <input
            className="input keyrow__delay"
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

/** "Hold triggers" card: the three hold-to-act modes behind one master switch. */
export function HoldTriggersCard(): JSX.Element {
  const { activeProfile, setSectionDisabled } = useStore()
  if (!activeProfile) return <></>

  const enabled = activeProfile.disabledSections?.['holdTriggers'] !== true

  return (
    <Section
      title="Hold triggers"
      description="Nothing runs on its own — things only happen while you hold a key."
      accent={SECTION_ACCENTS.holdTriggers}
      dim={!enabled}
      right={
        <SectionToggle
          checked={enabled}
          onChange={(v) => setSectionDisabled('holdTriggers', !v)}
          title="Enable the hold triggers"
        />
      }
    >
      <div className="trigrows">
        {TRIGGERS.map((t) => (
          <TriggerRow key={t.field} {...t} />
        ))}
      </div>
    </Section>
  )
}

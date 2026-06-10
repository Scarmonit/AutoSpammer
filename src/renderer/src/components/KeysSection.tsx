import React, { useState } from 'react'
import { useStore } from '../store'
import { Section } from './Section'
import { Accordion } from './Accordion'
import { SpamKeysTab } from './SpamKeysTab'
import { HoldActionsGroup } from './HoldActionsGroup'
import { PeriodicTab } from './PeriodicTab'

type Pane = 'spam' | 'hold' | 'periodic'

/**
 * "Keys & Actions" — one section that gathers everything you fire during a run,
 * organised into collapsible sub-sections (accordions):
 *   • Spam Keys (open by default): the key list, quick options, and preview.
 *   • Hold Actions (collapsed): Hold Keys Down + the three hold-trigger modes.
 *   • Periodic Actions (collapsed): the periodic key list with per-key timers.
 * Each part keeps its own Enabled switch; a dot on an accordion header shows when
 * something inside it is enabled. The underlying data is unchanged.
 */
export function KeysSection(): JSX.Element {
  const { activeProfile } = useStore()
  const [open, setOpen] = useState<Record<Pane, boolean>>({
    spam: true,
    hold: false,
    periodic: false
  })
  if (!activeProfile) return <></>
  const p = activeProfile

  const spamOn = p.options.enableKeys
  const holdOn =
    p.holdKeys.enabled || p.holdToSpam.enabled || p.focusHold.enabled || p.rightClickHold.enabled
  const periodicOn = p.periodicKey.enabled

  const toggle = (k: Pane): void => setOpen((o) => ({ ...o, [k]: !o[k] }))

  return (
    <Section title="Keys & Actions">
      <div className="accgroup">
        <Accordion title="Spam Keys" open={open.spam} on={spamOn} onToggle={() => toggle('spam')}>
          <SpamKeysTab />
        </Accordion>

        <Accordion
          title="Hold Actions"
          open={open.hold}
          on={holdOn}
          onToggle={() => toggle('hold')}
        >
          <HoldActionsGroup />
        </Accordion>

        <Accordion
          title="Periodic Actions"
          open={open.periodic}
          on={periodicOn}
          onToggle={() => toggle('periodic')}
        >
          <PeriodicTab />
        </Accordion>
      </div>
    </Section>
  )
}

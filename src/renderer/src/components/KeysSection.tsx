import React, { useState } from 'react'
import { useStore } from '../store'
import { Section } from './Section'
import { SectionToggle } from './SectionToggle'
import { Accordion } from './Accordion'
import { SpamKeysTab } from './SpamKeysTab'
import { PeriodicTab } from './PeriodicTab'

type Pane = 'spam' | 'periodic'

/**
 * "Keys to Spam" — the key list plus its quick options, with the Periodic key
 * presses tucked into a collapsible accordion below. (Hold Actions is now its own
 * separate top-level section.) Each part keeps its own Enabled switch, and a dot
 * on an accordion header shows when its feature is enabled.
 */
export function KeysSection(): JSX.Element {
  const { activeProfile, setSectionDisabled } = useStore()
  const [open, setOpen] = useState<Record<Pane, boolean>>({ spam: true, periodic: false })
  if (!activeProfile) return <></>

  const sectionEnabled = activeProfile.disabledSections?.['keys'] !== true
  const spamOn = activeProfile.options.enableKeys
  const periodicOn = activeProfile.periodicKey.enabled
  const toggle = (k: Pane): void => setOpen((o) => ({ ...o, [k]: !o[k] }))

  return (
    <Section
      title="Keys to Spam"
      dim={!sectionEnabled}
      right={
        <SectionToggle
          checked={sectionEnabled}
          onChange={(v) => setSectionDisabled('keys', !v)}
          title="Enable Keys to Spam (Spam Keys + Periodic) for runs"
        />
      }
    >
      <div className="accgroup">
        <Accordion title="Spam Keys" open={open.spam} on={spamOn} onToggle={() => toggle('spam')}>
          <SpamKeysTab />
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

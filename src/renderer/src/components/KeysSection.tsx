import React, { useState } from 'react'
import { useStore } from '../store'
import { Section } from './Section'
import { SectionToggle } from './SectionToggle'
import { Accordion } from './Accordion'
import { SpamKeysTab } from './SpamKeysTab'

/**
 * "Keys to Spam" — the key list plus its quick options, with the Periodic key
 * presses inlined below them (inside SpamKeysTab). Each part keeps its own
 * Enabled switch, and the accordion dot shows when either feature is enabled.
 */
export function KeysSection(): JSX.Element {
  const { activeProfile, setSectionDisabled } = useStore()
  const [open, setOpen] = useState(true)
  if (!activeProfile) return <></>

  const sectionEnabled = activeProfile.disabledSections?.['keys'] !== true
  const spamOn = activeProfile.options.enableKeys
  const periodicOn = activeProfile.periodicKey.enabled

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
        <Accordion
          title="Spam Keys"
          open={open}
          on={spamOn || periodicOn}
          onToggle={() => setOpen((o) => !o)}
        >
          <SpamKeysTab />
        </Accordion>
      </div>
    </Section>
  )
}

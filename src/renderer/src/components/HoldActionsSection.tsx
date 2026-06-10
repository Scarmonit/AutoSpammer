import React from 'react'
import { useStore } from '../store'
import { Section } from './Section'
import { SectionToggle } from './SectionToggle'
import { HoldActionsGroup } from './HoldActionsGroup'

/**
 * "Hold Actions" — its own top-level section (a draggable / resizable / hideable
 * panel) containing the Hold Keys Down list and the three hold-trigger modes.
 * A master Enabled toggle in the header (visible even when collapsed) gates the
 * whole section; the per-feature toggles inside still apply when it's enabled.
 */
export function HoldActionsSection(): JSX.Element {
  const { activeProfile, setSectionDisabled } = useStore()
  if (!activeProfile) return <></>

  const sectionEnabled = activeProfile.disabledSections?.['holdActions'] !== true

  return (
    <Section
      title="Hold Actions"
      dim={!sectionEnabled}
      right={
        <SectionToggle
          checked={sectionEnabled}
          onChange={(v) => setSectionDisabled('holdActions', !v)}
          title="Enable Hold Actions (Hold Keys Down + the hold-trigger modes) for runs"
        />
      }
    >
      <HoldActionsGroup />
    </Section>
  )
}

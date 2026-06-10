import React from 'react'
import { Section } from './Section'
import { HoldActionsGroup } from './HoldActionsGroup'

/**
 * "Hold Actions" — its own top-level section (a draggable / resizable / hideable
 * panel) containing the Hold Keys Down list and the three hold-trigger modes.
 * Split back out of "Keys to Spam"; the internal card layout is unchanged.
 */
export function HoldActionsSection(): JSX.Element {
  return (
    <Section title="Hold Actions">
      <HoldActionsGroup />
    </Section>
  )
}

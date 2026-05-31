import React from 'react'

interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Accessible/visible label, e.g. "Enabled". */
  label?: string
  title?: string
}

/**
 * Compact on/off switch designed to sit in a Section header (the `right` slot).
 * Used to enable/disable whether a section contributes to the spam run.
 */
export function SectionToggle({ checked, onChange, label = 'Enabled', title }: Props): JSX.Element {
  return (
    <label className="section__toggle" title={title ?? `${label} — include this section when spamming`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

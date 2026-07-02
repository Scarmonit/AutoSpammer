import React from 'react'

interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Accessible name for the switch, e.g. "Enabled". */
  label?: string
  title?: string
  /** Smaller switch for inline rows (hold triggers, settings). */
  small?: boolean
}

/**
 * Toggle switch, colored by the surrounding section's accent (--accent).
 * Sits in a Section header to enable/disable that card, and inline in rows.
 */
export function SectionToggle({ checked, onChange, label = 'Enabled', title, small = false }: Props): JSX.Element {
  return (
    <label
      className={`section__toggle${small ? ' section__toggle--sm' : ''}`}
      title={title ?? `${label} — include this when running`}
    >
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

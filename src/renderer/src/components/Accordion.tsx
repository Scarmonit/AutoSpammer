import React from 'react'

interface Props {
  title: string
  open: boolean
  onToggle: () => void
  /** Show a small dot when something inside this sub-section is enabled. */
  on?: boolean
  children: React.ReactNode
}

/**
 * A clean, native-feeling collapsible sub-section (accordion) with a chevron.
 * Used to group the parts of the "Keys & Actions" section so only what you're
 * working on is expanded.
 */
export function Accordion({ title, open, onToggle, on = false, children }: Props): JSX.Element {
  return (
    <div className={`acc${open ? ' acc--open' : ''}`}>
      <button type="button" className="acc__head" aria-expanded={open} onClick={onToggle}>
        <svg className="acc__chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M2.5 4.5 L6 8 L9.5 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="acc__title">{title}</span>
        {on && <span className="acc__dot" aria-hidden="true" title="Enabled" />}
      </button>
      {open && <div className="acc__body">{children}</div>}
    </div>
  )
}

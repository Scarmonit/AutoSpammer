import React from 'react'
import { useStore } from '../store'
import { useSectionId } from './sectionContext'

interface Props {
  title: string
  children: React.ReactNode
  right?: React.ReactNode
  /** Visually grey out the body (e.g. when the section is toggled off). */
  dim?: boolean
}

export function Section({ title, children, right, dim = false }: Props): JSX.Element {
  const id = useSectionId()
  const { activeProfile, toggleSectionCollapsed } = useStore()
  // Only sections rendered inside a ResizablePane (i.e. with an id) are collapsible.
  const collapsible = id !== null
  const collapsed = collapsible && !!activeProfile?.collapsedSections?.[id as string]

  return (
    <section className={`section${collapsed ? ' section--collapsed' : ''}`}>
      <header className="section__head">
        <h2 className="section__title">{title}</h2>
        <div className="section__head-actions">
          {right}
          {collapsible && (
            <button
              type="button"
              className="section__collapse"
              aria-expanded={!collapsed}
              aria-label={collapsed ? `Show ${title}` : `Hide ${title}`}
              title={collapsed ? 'Show section' : 'Hide section'}
              onClick={() => toggleSectionCollapsed(id as string)}
            >
              <svg
                className="section__chevron"
                width="12"
                height="12"
                viewBox="0 0 12 12"
                aria-hidden="true"
              >
                <path
                  d="M2.5 4.5 L6 8 L9.5 4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      </header>
      {/* Body stays mounted but hidden via CSS when collapsed, preserving state. */}
      <div className={`section__body${dim ? ' section__body--off' : ''}`}>{children}</div>
    </section>
  )
}

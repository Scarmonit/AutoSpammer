import React from 'react'
import { useStore } from '../store'
import { useSectionId, useSectionDrag } from './sectionContext'

interface Props {
  title: string
  children: React.ReactNode
  /** Friendly one-line description under the title (hidden by "Show hints"). */
  description?: string
  /** Accent color for the title dot + the header switch. */
  accent?: string
  right?: React.ReactNode
  /** Visually grey out the body (e.g. when the section is toggled off). */
  dim?: boolean
}

export function Section({ title, children, description, accent, right, dim = false }: Props): JSX.Element {
  const id = useSectionId()
  const drag = useSectionDrag()
  const { data, activeProfile, toggleSectionCollapsed } = useStore()
  // Only sections rendered inside a ResizablePane (i.e. with an id) are collapsible.
  const collapsible = id !== null
  const collapsed = collapsible && !!activeProfile?.collapsedSections?.[id as string]
  const showHints = data?.settings.showHints !== false

  return (
    <section
      className={`section${collapsed ? ' section--collapsed' : ''}`}
      style={accent ? ({ '--accent': accent } as React.CSSProperties) : undefined}
    >
      <header className="section__head">
        {/* The grip is the ONLY drag handle for reordering — the pane is not
            draggable, so body inputs and the resize splitter keep working. */}
        <span
          className="section__grip"
          title="Drag to move this section"
          draggable={drag?.draggable ?? false}
          onDragStart={drag?.onDragStart}
          onDragEnd={drag?.onDragEnd}
        >
          ⠿
        </span>
        <span className="section__dot" aria-hidden="true" />
        <div className="section__titles">
          <h2 className="section__title">{title}</h2>
          {description && showHints && <p className="section__desc hint">{description}</p>}
        </div>
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

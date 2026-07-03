import React, { useEffect, useRef } from 'react'
import { SECTION_IDS, SECTION_LABELS, SECTION_ACCENTS, isSectionHidden } from '@shared/sections'
import { useStore } from '../store'
import { SectionToggle } from './SectionToggle'

interface Props {
  onClose: () => void
}

/**
 * Sections picker: a dropdown panel anchored under the top bar's "Sections ▾"
 * button. Each section gets its accent dot and an accent-colored switch —
 * toggling one off hides the section from the window and skips its feature on
 * the next run; toggling back on restores it in its saved position.
 */
export function SectionManager({ onClose }: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const { activeProfile, setSectionHidden, showAllSections } = useStore()

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    // Close on any click outside the menu (its anchor button toggles itself).
    const onDown = (e: MouseEvent): void => {
      const target = e.target as Element | null
      if (target && !target.closest('.topbar__menuwrap')) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [onClose])

  if (!activeProfile) return <></>
  const hidden = activeProfile.hiddenSections
  const hiddenCount = SECTION_IDS.filter((id) => isSectionHidden(hidden, id)).length

  return (
    <div className="secmenu" ref={ref} role="dialog" aria-label="Sections">
      <div className="secmenu__title">Sections</div>
      <p className="secmenu__desc">
        Hidden sections disappear from the window and are skipped when running.
      </p>

      <ul className="secmenu__list">
        {SECTION_IDS.map((id) => {
          const visible = !isSectionHidden(hidden, id)
          const label = SECTION_LABELS[id] ?? id
          return (
            <li
              key={id}
              className="secmenu__row"
              style={{ '--accent': SECTION_ACCENTS[id] } as React.CSSProperties}
            >
              <span className="section__dot" aria-hidden="true" />
              <span className="secmenu__name">{label}</span>
              <SectionToggle
                checked={visible}
                onChange={(v) => setSectionHidden(id, !v)}
                label={label}
                title={`Show or hide "${label}"`}
              />
            </li>
          )
        })}
      </ul>

      <div className="secmenu__foot">
        <button
          type="button"
          className="btn btn--ghost"
          disabled={hiddenCount === 0}
          onClick={showAllSections}
        >
          Show all
        </button>
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  )
}

import React, { useEffect } from 'react'
import { SECTION_IDS, SECTION_LABELS, isSectionHidden } from '@shared/sections'
import { useStore } from '../store'

interface Props {
  onClose: () => void
}

/**
 * Sections manager: a popup listing every section with a visibility checkbox.
 * Unchecking hides the section from the UI and disables its feature on the next
 * run; re-checking restores it in its saved drag-and-drop position.
 */
export function SectionManager({ onClose }: Props): JSX.Element {
  const { activeProfile, setSectionHidden, showAllSections } = useStore()

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!activeProfile) return <></>
  const hidden = activeProfile.hiddenSections
  const hiddenCount = SECTION_IDS.filter((id) => isSectionHidden(hidden, id)).length

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Sections"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal__head">
          <h2 className="modal__title">👁️ Sections</h2>
          <button type="button" className="modal__close" aria-label="Close" title="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="modal__body">
          <p className="helper">
            Uncheck a section to hide it from the window and skip it when spamming. Re-check it to
            bring it back in its saved position.
          </p>

          <ul className="seclist">
            {SECTION_IDS.map((id) => {
              const visible = !isSectionHidden(hidden, id)
              return (
                <li key={id} className="seclist__row">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={(e) => setSectionHidden(id, !e.target.checked)}
                    />
                    <span>{SECTION_LABELS[id] ?? id}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>

        <footer className="modal__foot">
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
        </footer>
      </div>
    </div>
  )
}

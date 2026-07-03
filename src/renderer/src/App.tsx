import React, { useEffect, useState } from 'react'
import {
  normalizeLayout,
  moveSection,
  isSectionHidden,
  type SectionColumnName
} from '@shared/sections'
import { useStore } from './store'
import { TapKeysCard } from './components/TapKeysCard'
import { TimersCard } from './components/TimersCard'
import { HoldKeysCard } from './components/HoldKeysCard'
import { HoldTriggersCard } from './components/HoldTriggersCard'
import { TextFunctionPanel } from './components/TextFunctionPanel'
import { ClickPositionsPanel } from './components/ClickPositionsPanel'
import { MacroPanel } from './components/MacroPanel'
import { StatusIndicator } from './components/StatusIndicator'
import { ProfileBar } from './components/ProfileBar'
import { LoopBar } from './components/LoopBar'
import { SummaryBar } from './components/SummaryBar'
import { ResizablePane } from './components/ResizablePane'
import { SettingsModal } from './components/SettingsModal'
import { SectionManager } from './components/SectionManager'

// Each section id maps to its rendered card. Built once; the columns are laid
// out from the (per-profile) drag-and-drop order.
const SECTIONS: Record<string, JSX.Element> = {
  keys: <TapKeysCard />,
  timers: <TimersCard />,
  holdKeys: <HoldKeysCard />,
  holdTriggers: <HoldTriggersCard />,
  clickPositions: <ClickPositionsPanel />,
  textFunction: <TextFunctionPanel />,
  macro: <MacroPanel />
}

interface DropTarget {
  col: SectionColumnName
  index: number
}

interface ColumnProps {
  col: SectionColumnName
  ids: string[]
  dragId: string | null
  dropTarget: DropTarget | null
  onDragStartSection: (id: string) => void
  onDragEndSection: () => void
  onColumnDragOver: (col: SectionColumnName, e: React.DragEvent) => void
  onColumnDrop: (col: SectionColumnName, e: React.DragEvent) => void
}

function SectionColumn({
  col,
  ids,
  dragId,
  dropTarget,
  onDragStartSection,
  onDragEndSection,
  onColumnDragOver,
  onColumnDrop
}: ColumnProps): JSX.Element {
  const lineAt = (i: number): boolean =>
    dropTarget !== null && dropTarget.col === col && dropTarget.index === i

  return (
    <div
      className="column"
      onDragOver={(e) => onColumnDragOver(col, e)}
      onDrop={(e) => onColumnDrop(col, e)}
    >
      {ids.map((id, i) => (
        <React.Fragment key={id}>
          {lineAt(i) && <div className="rs-dropline" />}
          <ResizablePane
            id={id}
            last={i === ids.length - 1}
            dragging={dragId === id}
            onPaneDragStart={onDragStartSection}
            onPaneDragEnd={onDragEndSection}
          >
            {SECTIONS[id]}
          </ResizablePane>
        </React.Fragment>
      ))}
      {lineAt(ids.length) && <div className="rs-dropline" />}
    </div>
  )
}

export function App(): JSX.Element {
  const { loaded, data, message, dismissMessage, activeProfile, setSectionLayout } = useStore()
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [sectionsOpen, setSectionsOpen] = useState(false)

  // Auto-dismiss info toasts after a moment; keep errors until clicked.
  useEffect(() => {
    if (message?.kind === 'info') {
      const t = setTimeout(dismissMessage, 2500)
      return () => clearTimeout(t)
    }
    return undefined
  }, [message, dismissMessage])

  if (!loaded) {
    return <div className="loading">Loading…</div>
  }

  const layout = normalizeLayout(activeProfile?.sectionLayout)
  const hidden = activeProfile?.hiddenSections
  // The layout keeps every section (so hidden ones retain their saved position);
  // we only render the visible ones.
  const visible = {
    left: layout.left.filter((id) => !isSectionHidden(hidden, id)),
    right: layout.right.filter((id) => !isSectionHidden(hidden, id))
  }

  /** Insertion index within a column, measured against its rendered panes. */
  const indexFromPointer = (e: React.DragEvent): number => {
    const panes = Array.from(
      (e.currentTarget as HTMLElement).querySelectorAll('[data-rs-pane]')
    )
    const y = e.clientY
    for (let i = 0; i < panes.length; i++) {
      const r = panes[i].getBoundingClientRect()
      if (y < r.top + r.height / 2) return i
    }
    return panes.length
  }

  /**
   * Translate a drop index measured against the *visible* panes into an index in
   * the full (incl. hidden) column array, so dropping reorders the saved layout
   * correctly even when some sections are hidden.
   */
  const fullDropIndex = (col: SectionColumnName, visibleIndex: number): number => {
    const ids = layout[col]
    let seen = 0
    for (let i = 0; i < ids.length; i++) {
      if (seen === visibleIndex) return i
      if (!isSectionHidden(hidden, ids[i])) seen++
    }
    return ids.length
  }

  const onColumnDragOver = (col: SectionColumnName, e: React.DragEvent): void => {
    if (!dragId) return // ignore non-section drags (e.g. key-row reordering)
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const index = indexFromPointer(e)
    setDropTarget((prev) => (prev && prev.col === col && prev.index === index ? prev : { col, index }))
  }

  const onColumnDrop = (col: SectionColumnName, e: React.DragEvent): void => {
    if (!dragId) return
    e.preventDefault()
    setSectionLayout(moveSection(layout, dragId, col, fullDropIndex(col, indexFromPointer(e))))
    setDragId(null)
    setDropTarget(null)
  }

  const onDragStartSection = (id: string): void => setDragId(id)
  const onDragEndSection = (): void => {
    setDragId(null)
    setDropTarget(null)
  }

  const columnProps = {
    dragId,
    dropTarget,
    onDragStartSection,
    onDragEndSection,
    onColumnDragOver,
    onColumnDrop
  }

  return (
    <div className={`app${data?.settings.showHints === false ? ' app--nohints' : ''}`}>
      <header className="topbar">
        <ProfileBar />
        <div className="topbar__tools">
          <LoopBar />
          <div className="topbar__menuwrap">
            <button
              type="button"
              className="topbar__btn"
              title="Show or hide sections"
              aria-expanded={sectionsOpen}
              onClick={() => setSectionsOpen((o) => !o)}
            >
              Sections ▾
            </button>
            {sectionsOpen && <SectionManager onClose={() => setSectionsOpen(false)} />}
          </div>
          <button
            type="button"
            className="topbar__btn topbar__btn--icon"
            title="Options"
            aria-label="Options"
            onClick={() => setOptionsOpen(true)}
          >
            ⚙️
          </button>
          <StatusIndicator />
        </div>
      </header>

      <SummaryBar />

      {optionsOpen && <SettingsModal onClose={() => setOptionsOpen(false)} />}

      {message && (
        <div className={`toast toast--${message.kind}`} onClick={dismissMessage}>
          {message.text}
        </div>
      )}

      <main className="columns">
        <SectionColumn col="left" ids={visible.left} {...columnProps} />
        <SectionColumn col="right" ids={visible.right} {...columnProps} />
      </main>
    </div>
  )
}

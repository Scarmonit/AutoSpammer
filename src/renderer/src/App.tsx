import React, { useEffect, useState } from 'react'
import { normalizeLayout, moveSection, type SectionColumnName } from '@shared/sections'
import { useStore } from './store'
import { KeyList } from './components/KeyList'
import { OptionsPanel } from './components/OptionsPanel'
import { TextFunctionPanel } from './components/TextFunctionPanel'
import { ClickPositionsPanel } from './components/ClickPositionsPanel'
import { ProfilesPanel } from './components/ProfilesPanel'
import { LoopPanel } from './components/LoopPanel'
import { HotkeyPanel } from './components/HotkeyPanel'
import { HoldKeyPanel } from './components/HoldKeyPanel'
import { HoldKeysPanel } from './components/HoldKeysPanel'
import { PeriodicKeyPanel } from './components/PeriodicKeyPanel'
import { MacroPanel } from './components/MacroPanel'
import { StatusIndicator } from './components/StatusIndicator'
import { UiScaleControl } from './components/UiScaleControl'
import { BottomBar } from './components/BottomBar'
import { ResizablePane } from './components/ResizablePane'

// Each section id maps to its rendered panel. Built once; the columns are laid
// out from the (per-profile) drag-and-drop order.
const SECTIONS: Record<string, JSX.Element> = {
  keys: <KeyList />,
  options: <OptionsPanel />,
  clickPositions: <ClickPositionsPanel />,
  textFunction: <TextFunctionPanel />,
  holdKeys: <HoldKeysPanel />,
  macro: <MacroPanel />,
  profiles: <ProfilesPanel />,
  loop: <LoopPanel />,
  hotkeys: <HotkeyPanel />,
  holdToSpam: (
    <HoldKeyPanel
      field="holdToSpam"
      title="Hold-to-Spam Key"
      helper="Hold the key to spam your list, release to stop."
    />
  ),
  focusHold: (
    <HoldKeyPanel
      field="focusHold"
      title="Focus Hold Key"
      helper="Hold to rapidly fire ONLY this key/button itself."
    />
  ),
  rightClickHold: (
    <HoldKeyPanel
      field="rightClickHold"
      title="Hold for Right-Click"
      helper="Hold the set key/button to rapidly RIGHT-CLICK; release to stop."
    />
  ),
  periodicKey: <PeriodicKeyPanel />
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
  const { loaded, message, dismissMessage, activeProfile, setSectionLayout, resetSectionLayout } =
    useStore()
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)

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

  /** Insertion index within a column, measured against its current panes. */
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
    setSectionLayout(moveSection(layout, dragId, col, indexFromPointer(e)))
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
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" />
          <h1>Auto Spammer</h1>
        </div>
        <div className="topbar__tools">
          <UiScaleControl />
          <button
            type="button"
            className="topbar__btn"
            title="Reset the section layout to its default order"
            onClick={resetSectionLayout}
          >
            Reset Layout
          </button>
          <StatusIndicator />
        </div>
      </header>

      {message && (
        <div className={`toast toast--${message.kind}`} onClick={dismissMessage}>
          {message.text}
        </div>
      )}

      <main className="columns">
        <SectionColumn col="left" ids={layout.left} {...columnProps} />
        <SectionColumn col="right" ids={layout.right} {...columnProps} />
      </main>

      <BottomBar />
    </div>
  )
}

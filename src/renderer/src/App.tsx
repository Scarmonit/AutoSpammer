import React, { useEffect } from 'react'
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
import { BottomBar } from './components/BottomBar'
import { ResizablePane } from './components/ResizablePane'

export function App(): JSX.Element {
  const { loaded, message, dismissMessage } = useStore()

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

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" />
          <h1>Auto Spammer</h1>
        </div>
        <StatusIndicator />
      </header>

      {message && (
        <div className={`toast toast--${message.kind}`} onClick={dismissMessage}>
          {message.text}
        </div>
      )}

      <main className="columns">
        <div className="column">
          <ResizablePane id="keys">
            <KeyList />
          </ResizablePane>
          <ResizablePane id="options">
            <OptionsPanel />
          </ResizablePane>
          <ResizablePane id="clickPositions">
            <ClickPositionsPanel />
          </ResizablePane>
          <ResizablePane id="textFunction">
            <TextFunctionPanel />
          </ResizablePane>
          <ResizablePane id="holdKeys">
            <HoldKeysPanel />
          </ResizablePane>
          <ResizablePane id="macro" last>
            <MacroPanel />
          </ResizablePane>
        </div>
        <div className="column">
          <ResizablePane id="profiles">
            <ProfilesPanel />
          </ResizablePane>
          <ResizablePane id="loop">
            <LoopPanel />
          </ResizablePane>
          <ResizablePane id="hotkeys">
            <HotkeyPanel />
          </ResizablePane>
          <ResizablePane id="holdToSpam">
            <HoldKeyPanel
              field="holdToSpam"
              title="Hold-to-Spam Key"
              helper="Hold the key to spam your list, release to stop."
            />
          </ResizablePane>
          <ResizablePane id="focusHold">
            <HoldKeyPanel
              field="focusHold"
              title="Focus Hold Key"
              helper="Hold to rapidly fire ONLY this key/button itself."
            />
          </ResizablePane>
          <ResizablePane id="rightClickHold">
            <HoldKeyPanel
              field="rightClickHold"
              title="Hold for Right-Click"
              helper="Hold the set key/button to rapidly RIGHT-CLICK; release to stop."
            />
          </ResizablePane>
          <ResizablePane id="periodicKey" last>
            <PeriodicKeyPanel />
          </ResizablePane>
        </div>
      </main>

      <BottomBar />
    </div>
  )
}

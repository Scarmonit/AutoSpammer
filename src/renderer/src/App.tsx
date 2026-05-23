import React, { useEffect } from 'react'
import { useStore } from './store'
import { KeyList } from './components/KeyList'
import { OptionsPanel } from './components/OptionsPanel'
import { TextFunctionPanel } from './components/TextFunctionPanel'
import { ProfilesPanel } from './components/ProfilesPanel'
import { LoopPanel } from './components/LoopPanel'
import { HotkeyPanel } from './components/HotkeyPanel'
import { HoldKeyPanel } from './components/HoldKeyPanel'
import { StatusIndicator } from './components/StatusIndicator'
import { BottomBar } from './components/BottomBar'

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
          <KeyList />
          <OptionsPanel />
          <TextFunctionPanel />
        </div>
        <div className="column">
          <ProfilesPanel />
          <LoopPanel />
          <HotkeyPanel />
          <HoldKeyPanel
            field="holdToSpam"
            title="Hold-to-Spam Key"
            helper="Hold the key to spam your list, release to stop."
          />
          <HoldKeyPanel
            field="focusHold"
            title="Focus Hold Key"
            helper="Hold to rapidly fire ONLY this key/button itself."
          />
        </div>
      </main>

      <BottomBar />
    </div>
  )
}

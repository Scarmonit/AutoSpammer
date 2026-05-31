import React from 'react'
import { useStore } from '../store'

export function BottomBar(): JSX.Element {
  const { status, start, stop, activeProfile, macroPlaying } = useStore()
  const running = status.status === 'running'
  const macroMode = !!activeProfile?.macro.enabled

  // While a one-shot macro preview is running from the panel, the main button
  // is inert (that preview owns playback until it finishes / is stopped there).
  const disabled = macroPlaying && !running

  const label = running
    ? macroMode
      ? 'Stop Macro'
      : 'Stop Spam'
    : macroMode
      ? 'Start Macro'
      : 'Start Spam'

  return (
    <div className="bottombar">
      <button
        type="button"
        className={`startbtn ${running ? 'startbtn--stop' : ''}`}
        disabled={disabled}
        onClick={() => void (running ? stop() : start())}
      >
        {label}
      </button>
    </div>
  )
}

import React from 'react'
import { useStore } from '../store'

export function BottomBar(): JSX.Element {
  const { status, start, stop } = useStore()
  const running = status.status === 'running'

  return (
    <div className="bottombar">
      <button
        type="button"
        className={`startbtn ${running ? 'startbtn--stop' : ''}`}
        onClick={() => void (running ? stop() : start())}
      >
        {running ? 'Stop Spam' : 'Start Spam'}
      </button>
    </div>
  )
}

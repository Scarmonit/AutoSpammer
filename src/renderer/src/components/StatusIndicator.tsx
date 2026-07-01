import React from 'react'
import { useStore } from '../store'

const MODE_LABEL: Record<string, string> = {
  manual: 'Running',
  hold: 'Hold-to-Spam',
  'focus-hold': 'Focus Hold',
  'right-click-hold': 'Right-Click Hold'
}

export function StatusIndicator(): JSX.Element {
  const { status } = useStore()
  const running = status.status === 'running'
  const label = running ? MODE_LABEL[status.mode ?? 'manual'] ?? 'Running' : 'Idle'

  return (
    <div className={`status ${running ? 'status--on' : ''}`}>
      <span className="status__dot" />
      <span className="status__text">{label}</span>
      {running && <span className="status__cycles">· {status.cyclesDone} cycles</span>}
    </div>
  )
}

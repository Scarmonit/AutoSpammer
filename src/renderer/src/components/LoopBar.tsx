import React from 'react'
import type { LoopMode } from '@shared/types'
import { useStore } from '../store'

/**
 * Compact loop control for the header toolbar (replaces the old Loop section):
 * a mode dropdown (Forever / Play Once / Loop X times) with an inline count
 * field shown only when counting.
 */
export function LoopBar(): JSX.Element {
  const { activeProfile, updateProfile } = useStore()
  if (!activeProfile) return <></>
  const loop = activeProfile.loop

  const setMode = (mode: LoopMode): void =>
    updateProfile((p) => ({ ...p, loop: { ...p.loop, mode } }))
  const setCount = (count: number): void =>
    updateProfile((p) => ({ ...p, loop: { ...p.loop, count: Math.max(1, Math.floor(count) || 1) } }))

  return (
    <div className="subbar__group">
      <span className="subbar__label">Loop</span>
      <select
        className="input select subbar__select"
        value={loop.mode}
        onChange={(e) => setMode(e.target.value as LoopMode)}
        title="How many times to repeat each run"
      >
        <option value="forever">Forever</option>
        <option value="once">Play Once</option>
        <option value="count">Loop X times</option>
      </select>

      {loop.mode === 'count' && (
        <>
          <input
            className="input subbar__count"
            type="number"
            min={1}
            value={loop.count}
            onChange={(e) => setCount(Number(e.target.value))}
            aria-label="Loop count"
          />
          <span className="subbar__label">times</span>
        </>
      )}
    </div>
  )
}

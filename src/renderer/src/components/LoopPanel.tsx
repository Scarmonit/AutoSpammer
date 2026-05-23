import React from 'react'
import type { LoopMode } from '@shared/types'
import { useStore } from '../store'
import { Section } from './Section'

export function LoopPanel(): JSX.Element {
  const { activeProfile, updateProfile } = useStore()
  if (!activeProfile) return <></>
  const loop = activeProfile.loop

  const setMode = (mode: LoopMode): void =>
    updateProfile((p) => ({ ...p, loop: { ...p.loop, mode } }))
  const setCount = (count: number): void =>
    updateProfile((p) => ({ ...p, loop: { ...p.loop, count: Math.max(1, Math.floor(count) || 1) } }))

  return (
    <Section title="Loop">
      <label className="radio">
        <input type="radio" name="loop" checked={loop.mode === 'forever'} onChange={() => setMode('forever')} />
        <span>Loop Forever</span>
      </label>
      <label className="radio">
        <input type="radio" name="loop" checked={loop.mode === 'once'} onChange={() => setMode('once')} />
        <span>Play Once</span>
      </label>
      <label className="radio">
        <input type="radio" name="loop" checked={loop.mode === 'count'} onChange={() => setMode('count')} />
        <span>Loop</span>
        <input
          className="input input--mini"
          type="number"
          min={1}
          value={loop.count}
          disabled={loop.mode !== 'count'}
          onChange={(e) => setCount(Number(e.target.value))}
        />
        <span>times</span>
      </label>
    </Section>
  )
}

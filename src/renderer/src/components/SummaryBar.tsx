import React from 'react'
import { applyHiddenSections } from '@shared/sections'
import { useStore } from '../store'
import { prettyName } from '../keycapture'

/**
 * "WHEN RUNNING" bar: a live plain-English description of what the current
 * profile will do on the next run — only the sections that are actually
 * enabled (hidden / master-disabled ones are excluded via the same gating
 * the engine uses), plus the loop setting.
 */
export function SummaryBar(): JSX.Element | null {
  const { data, activeProfile } = useStore()
  if (!data || !activeProfile || data.settings.showSummaryBar === false) return null

  const p = applyHiddenSections(activeProfile)
  const parts: string[] = []

  if (p.options.enableKeys) {
    const keys = [
      ...p.entries.map((e) => (e.kind === 'key' ? (e.key.trim() ? prettyName(e.key) : '') : prettyName(e.kind))),
      ...(p.options.spacebar ? ['Space'] : []),
      ...(p.options.leftClick ? ['Left Click'] : []),
      ...(p.options.rightClick ? ['Right Click'] : [])
    ].filter(Boolean)
    if (keys.length > 0) {
      const seq = p.options.sequenceMode ? ', one at a time' : ''
      parts.push(`tap ${keys.join(', ')} every ${p.options.defaultDelayMs} ms${seq}`)
    }
  }

  if (p.periodicKey.enabled) {
    for (const e of p.periodicKey.entries) {
      if ((e.key ?? '').trim()) parts.push(`press ${prettyName(e.key)} every ${e.intervalSec} s`)
    }
  }

  if (p.holdKeys.enabled) {
    const held = p.holdKeys.keys.filter((k) => k.trim() !== '').map(prettyName)
    if (held.length > 0) parts.push(`hold ${held.join(', ')} down`)
  }

  if (p.options.enableClickPositions && p.clickPositions.length > 0) {
    parts.push(`click ${p.clickPositions.length} spot${p.clickPositions.length === 1 ? '' : 's'}`)
  }

  if (p.textFunction.enabled && p.textFunction.text) {
    parts.push(`type "${p.textFunction.text}"`)
  }

  if (p.macro.enabled && p.macro.events.length > 0) {
    parts.push(`play the macro (${p.macro.events.length} events)`)
  }

  if (p.detection?.enabled) {
    const ready = p.detection.triggers.filter(
      (t) => t.enabled && (t.mode === 'color' ? t.color !== '' : t.image !== null)
    ).length
    if (ready > 0) parts.push(`watch ${ready} detection trigger${ready === 1 ? '' : 's'}`)
  }

  const loop =
    p.loop.mode === 'forever'
      ? 'loops forever'
      : p.loop.mode === 'once'
        ? 'plays once'
        : `loops ${p.loop.count} times`

  return (
    <div className="summarybar">
      <span className="summarybar__label">When running</span>
      <span className="summarybar__text">
        {parts.length > 0 ? (
          `${parts.join(' · ')} — ${loop}`
        ) : (
          <span className="muted">nothing yet — switch something on below</span>
        )}
      </span>
    </div>
  )
}

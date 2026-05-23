import React from 'react'
import { useStore } from '../store'
import { Section } from './Section'

export function TextFunctionPanel(): JSX.Element {
  const { activeProfile, updateProfile } = useStore()
  if (!activeProfile) return <></>
  const tf = activeProfile.textFunction

  const patch = (p: Partial<typeof tf>): void =>
    updateProfile((prof) => ({ ...prof, textFunction: { ...prof.textFunction, ...p } }))

  return (
    <Section title="Text Function">
      <label className="check">
        <input type="checkbox" checked={tf.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
        <span>Type a string each cycle</span>
      </label>

      <div className="field">
        <label>Text</label>
        <input
          className="input"
          value={tf.text}
          placeholder="text to type"
          disabled={!tf.enabled}
          onChange={(e) => patch({ text: e.target.value })}
        />
      </div>

      <div className="field">
        <label>Delay</label>
        <div className="field__input">
          <input
            className="input"
            type="number"
            min={0}
            value={tf.delayMs}
            disabled={!tf.enabled}
            onChange={(e) => patch({ delayMs: Math.max(0, Number(e.target.value) || 0) })}
          />
          <span className="keyrow__unit">ms</span>
        </div>
      </div>
    </Section>
  )
}

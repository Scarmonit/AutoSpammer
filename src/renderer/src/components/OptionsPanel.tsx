import React from 'react'
import { useStore } from '../store'
import { Section } from './Section'

export function OptionsPanel(): JSX.Element {
  const { activeProfile, patchOptions } = useStore()
  if (!activeProfile) return <></>
  const o = activeProfile.options

  return (
    <Section title="Options">
      <label className="check">
        <input
          type="checkbox"
          checked={o.spacebar}
          onChange={(e) => patchOptions({ spacebar: e.target.checked })}
        />
        <span>Spacebar</span>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={o.leftClick}
          onChange={(e) => patchOptions({ leftClick: e.target.checked })}
        />
        <span>Left Mouse Click</span>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={o.rightClick}
          onChange={(e) => patchOptions({ rightClick: e.target.checked })}
        />
        <span>Right Mouse Click</span>
      </label>

      <div className="field">
        <label>Default Delay</label>
        <div className="field__input">
          <input
            className="input"
            type="number"
            min={0}
            value={o.defaultDelayMs}
            onChange={(e) => patchOptions({ defaultDelayMs: Math.max(0, Number(e.target.value) || 0) })}
          />
          <span className="keyrow__unit">ms</span>
        </div>
      </div>

      <label className="check">
        <input
          type="checkbox"
          checked={o.sequenceMode}
          onChange={(e) => patchOptions({ sequenceMode: e.target.checked })}
        />
        <span>Sequence Mode (fire keys one at a time)</span>
      </label>
    </Section>
  )
}

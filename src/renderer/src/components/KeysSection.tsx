import React, { useState } from 'react'
import { useStore } from '../store'
import { Section } from './Section'
import { SpamKeysTab } from './SpamKeysTab'
import { HoldKeysTab } from './HoldKeysTab'
import { PeriodicTab } from './PeriodicTab'

type KeysTab = 'spam' | 'hold' | 'periodic'

const TABS: { id: KeysTab; label: string }[] = [
  { id: 'spam', label: 'Spam Keys' },
  { id: 'hold', label: 'Hold Keys' },
  { id: 'periodic', label: 'Periodic' }
]

/**
 * "Keys to Spam" — the main keys container. The former standalone "Hold Keys
 * Down" and "Periodic Key" sections are now tabs inside it, shown one at a time
 * to keep the section uncluttered. A dot marks any tab whose feature is enabled,
 * so what's armed is visible at a glance. Each tab keeps all of its original
 * controls; the underlying data (entries / holdKeys / periodicKey) is unchanged.
 */
export function KeysSection(): JSX.Element {
  const { activeProfile } = useStore()
  const [tab, setTab] = useState<KeysTab>('spam')
  if (!activeProfile) return <></>

  const on: Record<KeysTab, boolean> = {
    spam: activeProfile.options.enableKeys,
    hold: activeProfile.holdKeys.enabled,
    periodic: activeProfile.periodicKey.enabled
  }

  return (
    <Section title="Keys to Spam">
      <div className="keystabs" role="tablist" aria-label="Keys">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tab}
            className={`keytab${t.id === tab ? ' keytab--active' : ''}${on[t.id] ? ' keytab--on' : ''}`}
            title={on[t.id] ? `${t.label} — enabled` : t.label}
            onClick={() => setTab(t.id)}
          >
            {on[t.id] && <span className="keytab__dot" aria-hidden="true" />}
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'spam' && <SpamKeysTab />}
        {tab === 'hold' && <HoldKeysTab />}
        {tab === 'periodic' && <PeriodicTab />}
      </div>
    </Section>
  )
}

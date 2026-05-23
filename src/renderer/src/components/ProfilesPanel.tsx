import React, { useState } from 'react'
import { useStore } from '../store'
import { Section } from './Section'

export function ProfilesPanel(): JSX.Element {
  const {
    data,
    activeProfile,
    createProfile,
    renameProfile,
    deleteProfile,
    setActiveProfile,
    saveNow
  } = useStore()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (!data || !activeProfile) return <></>

  const startRename = (): void => {
    setDraft(activeProfile.name)
    setEditing(true)
  }
  const commitRename = (): void => {
    void renameProfile(activeProfile.id, draft)
    setEditing(false)
  }

  return (
    <Section title="Profiles">
      {editing ? (
        <div className="field__input">
          <input
            className="input"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setEditing(false)
            }}
          />
          <button type="button" className="btn btn--primary" onClick={commitRename}>
            OK
          </button>
        </div>
      ) : (
        <select
          className="input select"
          value={activeProfile.id}
          onChange={(e) => void setActiveProfile(e.target.value)}
        >
          {data.profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}

      <div className="btn-row">
        <button type="button" className="btn btn--ghost" onClick={() => void createProfile('')}>
          New
        </button>
        <button type="button" className="btn btn--ghost" onClick={startRename}>
          Rename
        </button>
        <button type="button" className="btn btn--primary" onClick={() => void saveNow()}>
          Save
        </button>
        <button
          type="button"
          className="btn btn--danger"
          disabled={data.profiles.length <= 1}
          onClick={() => void deleteProfile(activeProfile.id)}
        >
          Delete
        </button>
      </div>
    </Section>
  )
}

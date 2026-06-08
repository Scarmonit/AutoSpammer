import React, { useState } from 'react'
import { useStore } from '../store'

/**
 * Compact profile picker for the header toolbar (replaces the old Profiles
 * section): a dropdown of profiles plus New / Rename / Save / Delete actions.
 * Renaming swaps the dropdown for an inline text field, exactly like before.
 */
export function ProfileBar(): JSX.Element {
  const { data, activeProfile, createProfile, renameProfile, deleteProfile, setActiveProfile, saveNow } =
    useStore()
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
    <div className="subbar__group">
      <span className="subbar__label">Profile</span>

      {editing ? (
        <>
          <input
            className="input subbar__rename"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setEditing(false)
            }}
          />
          <button type="button" className="btn btn--primary subbar__btn" onClick={commitRename}>
            OK
          </button>
          <button type="button" className="btn btn--ghost subbar__btn" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </>
      ) : (
        <>
          <select
            className="input select subbar__select"
            value={activeProfile.id}
            onChange={(e) => void setActiveProfile(e.target.value)}
            title="Switch profile"
          >
            {data.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn--ghost subbar__btn"
            title="New profile"
            onClick={() => void createProfile('')}
          >
            New
          </button>
          <button
            type="button"
            className="btn btn--ghost subbar__btn"
            title="Rename profile"
            onClick={startRename}
          >
            Rename
          </button>
          <button
            type="button"
            className="btn btn--primary subbar__btn"
            title="Save profile"
            onClick={() => void saveNow()}
          >
            Save
          </button>
          <button
            type="button"
            className="btn btn--danger subbar__btn"
            title="Delete profile"
            disabled={data.profiles.length <= 1}
            onClick={() => void deleteProfile(activeProfile.id)}
          >
            Delete
          </button>
        </>
      )}
    </div>
  )
}

import React from 'react'
import { useStore } from '../store'

/**
 * Compact profile picker for the header toolbar: a dropdown of profiles plus
 * New / Save / Delete actions.
 */
export function ProfileBar(): JSX.Element {
  const { data, activeProfile, createProfile, deleteProfile, setActiveProfile, saveNow } = useStore()

  if (!data || !activeProfile) return <></>

  return (
    <div className="subbar__group">
      <span className="subbar__label">Profile</span>

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
        className="btn btn--primary subbar__btn"
        title="New profile"
        onClick={() => void createProfile('')}
      >
        New
      </button>
      <button
        type="button"
        className="btn btn--ghost subbar__btn"
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
    </div>
  )
}

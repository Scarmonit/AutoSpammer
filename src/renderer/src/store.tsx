import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import type {
  PersistedData,
  Profile,
  AppSettings,
  StatusPayload,
  Options,
  SpamEntry,
  ClickPosition,
  AuxStatus
} from '@shared/types'
import { makeId } from '@shared/defaults'

type Message = { kind: 'error' | 'info'; text: string } | null

interface Store {
  loaded: boolean
  data: PersistedData | null
  activeProfile: Profile | null
  status: StatusPayload
  aux: AuxStatus
  recording: boolean
  recordingPositions: boolean
  message: Message
  dismissMessage: () => void

  updateProfile: (updater: (p: Profile) => Profile) => void
  patchOptions: (patch: Partial<Options>) => void
  /** Persist a resizable-section pixel height (per profile). */
  setSectionHeight: (id: string, height: number) => void
  /** Clear a section's stored height so it returns to its natural size. */
  resetSectionHeight: (id: string) => void

  createProfile: (name: string) => Promise<void>
  renameProfile: (id: string, name: string) => Promise<void>
  deleteProfile: (id: string) => Promise<void>
  setActiveProfile: (id: string) => Promise<void>
  saveNow: () => Promise<void>
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>

  start: () => Promise<void>
  stop: () => Promise<void>
  toggleRecording: () => Promise<void>
  toggleRecordingPositions: () => Promise<void>
  addCurrentPosition: () => Promise<void>
  toggleHold: () => Promise<void>
  togglePeriodic: () => Promise<void>
}

const Ctx = createContext<Store | null>(null)

const IDLE: StatusPayload = { status: 'idle', mode: null, cyclesDone: 0 }

export function StoreProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [data, setData] = useState<PersistedData | null>(null)
  const [status, setStatus] = useState<StatusPayload>(IDLE)
  const [aux, setAux] = useState<AuxStatus>({ holdActive: false, periodicActive: false })
  const [recording, setRecording] = useState(false)
  const [recordingPositions, setRecordingPositions] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dataRef = useRef<PersistedData | null>(null)
  dataRef.current = data

  const activeProfile =
    data?.profiles.find((p) => p.id === data.settings.activeProfileId) ??
    data?.profiles[0] ??
    null

  // Initial load + event subscriptions.
  useEffect(() => {
    void window.api.getData().then(setData)

    const offStatus = window.api.onStatus(setStatus)
    const offError = window.api.onError((text) => setMessage({ kind: 'error', text }))
    const offConflict = window.api.onHotkeyConflict((c) =>
      setMessage({ kind: 'error', text: c.message })
    )
    // The global record-position hotkey mutates data in the main process.
    const offData = window.api.onDataUpdated(setData)
    // Hold-keys / periodic toggles can change from global hotkeys too.
    const offAux = window.api.onAuxStatus(setAux)
    void window.api.getAuxStatus().then(setAux)
    const offRecorded = window.api.onKeyRecorded((rk) => {
      const entry: SpamEntry = {
        id: makeId('key'),
        kind: rk.kind,
        key: rk.kind === 'key' ? rk.key : '',
        delayMs: null
      }
      updateProfileRef.current((p) => ({ ...p, entries: [...p.entries, entry] }))
    })

    return () => {
      offStatus()
      offError()
      offConflict()
      offData()
      offAux()
      offRecorded()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist the active profile (debounced) without blocking the UI.
  const scheduleSave = useCallback((profile: Profile) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void window.api.saveProfile(profile)
    }, 350)
  }, [])

  const updateProfile = useCallback(
    (updater: (p: Profile) => Profile) => {
      setData((prev) => {
        if (!prev) return prev
        const current = prev.profiles.find((p) => p.id === prev.settings.activeProfileId)
        if (!current) return prev
        const next = updater(current)
        scheduleSave(next)
        return {
          ...prev,
          profiles: prev.profiles.map((p) => (p.id === next.id ? next : p))
        }
      })
    },
    [scheduleSave]
  )

  // Keep a stable ref so the recorded-key listener always calls the latest fn.
  const updateProfileRef = useRef(updateProfile)
  updateProfileRef.current = updateProfile

  const patchOptions = useCallback(
    (patch: Partial<Options>) => {
      updateProfile((p) => ({ ...p, options: { ...p.options, ...patch } }))
    },
    [updateProfile]
  )

  const setSectionHeight = useCallback(
    (id: string, height: number) => {
      updateProfile((p) => ({
        ...p,
        sectionHeights: { ...(p.sectionHeights ?? {}), [id]: Math.round(height) }
      }))
    },
    [updateProfile]
  )

  const resetSectionHeight = useCallback(
    (id: string) => {
      updateProfile((p) => {
        const next = { ...(p.sectionHeights ?? {}) }
        delete next[id]
        return { ...p, sectionHeights: next }
      })
    },
    [updateProfile]
  )

  const createProfile = useCallback(async (name: string) => setData(await window.api.createProfile(name)), [])
  const renameProfile = useCallback(
    async (id: string, name: string) => setData(await window.api.renameProfile(id, name)),
    []
  )
  const deleteProfile = useCallback(async (id: string) => setData(await window.api.deleteProfile(id)), [])
  const setActiveProfile = useCallback(
    async (id: string) => setData(await window.api.setActiveProfile(id)),
    []
  )
  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => setData(await window.api.updateSettings(patch)),
    []
  )

  const saveNow = useCallback(async () => {
    const current = dataRef.current
    const prof = current?.profiles.find((p) => p.id === current.settings.activeProfileId)
    if (!prof) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    await window.api.saveProfile(prof)
    setMessage({ kind: 'info', text: 'Profile saved.' })
  }, [])

  const start = useCallback(async () => {
    setStatus(await window.api.start())
  }, [])
  const stop = useCallback(async () => {
    setStatus(await window.api.stop())
  }, [])

  const addCurrentPosition = useCallback(async () => {
    const { x, y } = await window.api.getMousePosition()
    const pos: ClickPosition = { id: makeId('pos'), x, y, button: 'left', delayMs: null }
    updateProfile((p) => ({ ...p, clickPositions: [...p.clickPositions, pos] }))
  }, [updateProfile])

  const toggleHold = useCallback(async () => {
    setAux(await window.api.toggleHold())
  }, [])
  const togglePeriodic = useCallback(async () => {
    setAux(await window.api.togglePeriodic())
  }, [])

  const toggleRecording = useCallback(async () => {
    if (recording) {
      await window.api.recordStop()
      setRecording(false)
      setMessage(null)
    } else {
      await window.api.recordStart()
      setRecording(true)
      setMessage({ kind: 'info', text: 'Recording… press keys/buttons to add them, then click Stop.' })
    }
  }, [recording])

  const toggleRecordingPositions = useCallback(async () => {
    if (recordingPositions) {
      await window.api.recordPositionsStop()
      setRecordingPositions(false)
      setMessage(null)
    } else {
      await window.api.recordPositionsStart()
      setRecordingPositions(true)
      setMessage({
        kind: 'info',
        text: 'Recording clicks… every left/right click is saved as a position. Click Stop when done.'
      })
    }
  }, [recordingPositions])

  const value: Store = {
    loaded: data !== null,
    data,
    activeProfile,
    status,
    aux,
    recording,
    recordingPositions,
    message,
    dismissMessage: () => setMessage(null),
    updateProfile,
    patchOptions,
    setSectionHeight,
    resetSectionHeight,
    createProfile,
    renameProfile,
    deleteProfile,
    setActiveProfile,
    saveNow,
    updateSettings,
    start,
    stop,
    toggleRecording,
    toggleRecordingPositions,
    addCurrentPosition,
    toggleHold,
    togglePeriodic
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

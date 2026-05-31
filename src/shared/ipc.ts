// Centralised IPC channel names so the main process, preload, and renderer
// can never drift out of sync.

export const IPC = {
  // renderer -> main (invoke / handle)
  GetData: 'data:get',
  SaveProfile: 'profile:save',
  CreateProfile: 'profile:create',
  RenameProfile: 'profile:rename',
  DeleteProfile: 'profile:delete',
  SetActiveProfile: 'profile:set-active',
  UpdateSettings: 'settings:update',
  Start: 'engine:start',
  Stop: 'engine:stop',
  GetStatus: 'engine:status',
  RecordStart: 'record:start',
  RecordStop: 'record:stop',
  RecordPositionsStart: 'record-positions:start',
  RecordPositionsStop: 'record-positions:stop',
  GetMousePosition: 'mouse:get-position',
  ToggleHold: 'aux:toggle-hold',
  TogglePeriodic: 'aux:toggle-periodic',
  GetAuxStatus: 'aux:status',

  // main -> renderer (events)
  StatusChanged: 'event:status',
  KeyRecorded: 'event:key-recorded',
  ErrorEvent: 'event:error',
  HotkeyConflict: 'event:hotkey-conflict',
  DataUpdated: 'event:data-updated',
  AuxStatusChanged: 'event:aux-status'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]

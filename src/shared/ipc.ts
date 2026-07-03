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
  ExportProfile: 'profile:export',
  ImportProfile: 'profile:import',
  UpdateSettings: 'settings:update',
  Start: 'engine:start',
  Stop: 'engine:stop',
  GetStatus: 'engine:status',
  RecordStart: 'record:start',
  RecordStop: 'record:stop',
  RecordPositionsStart: 'record-positions:start',
  RecordPositionsStop: 'record-positions:stop',
  GetMousePosition: 'mouse:get-position',
  // Key-capture overlay: suspend/resume every global hotkey + hold trigger so
  // the pressed key is bound instead of firing its current action.
  CaptureStart: 'capture:start',
  CaptureStop: 'capture:stop',
  MacroRecordStart: 'macro:record-start',
  MacroRecordStop: 'macro:record-stop',
  MacroPlay: 'macro:play',
  MacroStopPlay: 'macro:stop',

  // main -> renderer (events)
  StatusChanged: 'event:status',
  KeyRecorded: 'event:key-recorded',
  ErrorEvent: 'event:error',
  HotkeyConflict: 'event:hotkey-conflict',
  DataUpdated: 'event:data-updated',
  MacroRecording: 'event:macro-recording',
  MacroPlaying: 'event:macro-playing'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]

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
  // Detection triggers: one-shot "pick a pixel" / two-click "capture a region"
  // flows driven by the global mouse hook (work while a game is focused).
  DetectionPickPixel: 'detection:pick-pixel',
  DetectionCaptureRegion: 'detection:capture-region',

  // main -> renderer (events)
  StatusChanged: 'event:status',
  KeyRecorded: 'event:key-recorded',
  ErrorEvent: 'event:error',
  HotkeyConflict: 'event:hotkey-conflict',
  DataUpdated: 'event:data-updated',
  MacroRecording: 'event:macro-recording',
  MacroPlaying: 'event:macro-playing',
  PixelPicked: 'event:pixel-picked',
  RegionCaptured: 'event:region-captured'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]

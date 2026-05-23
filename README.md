# Auto Spammer

A dark-themed Windows desktop **macro / auto key-spammer** utility built with
**Electron + React + TypeScript**. It simulates keyboard and mouse input
globally, supports global hotkeys while unfocused, hold-to-spam and focus-hold
modes, sequence playback, loop controls, a text-typing function, and JSON
profiles that persist to disk.

> ⚠️ **Use responsibly.** This tool sends synthetic input to whatever window is
> focused. Many online games and competitive platforms forbid input automation —
> using it there can get your account banned. Only use it where automation is
> allowed (single-player games, your own apps, accessibility, testing, etc.).

---

## Features

- **Keys to Spam** — reorderable (drag) list of keys, each with an optional
  per-key delay that overrides the global default. Mouse-click entries supported.
- **Record** — capture physical key/button presses straight into the list.
- **Options** — toggle Spacebar / Left Click / Right Click, set a global default
  delay, and enable **Sequence Mode** (fire one entry per cycle instead of all).
- **Text Function** — type a full string each cycle with its own delay.
- **Profiles** — create / rename / save / delete; everything persists to JSON.
- **Loop** — Forever, Play Once, or a fixed number of times.
- **Toggle Hotkey** — global start/stop that works even when unfocused.
- **Emergency Stop** — global hotkey (default `Esc`) active while running.
- **Hold-to-Spam** — spam your list only while a chosen key/button is physically held.
- **Focus Hold** — rapidly fire *only* the chosen key itself while held.
- **Safety** — running indicator, numeric validation, hotkey-conflict detection,
  debounced hotkey re-registration, single set of input listeners, and a spam
  loop that runs in the main process off the UI thread.

---

## Tech / architecture

```
src/
  shared/        types, IPC channel names, default data  (used by all layers)
  main/          Electron main process
    index.ts       window + IPC orchestration + input validation
    engine.ts      cancellable spam loop (off the UI thread)
    hotkeys.ts     globalShortcut + uiohook listeners (record / hold detection)
    input.ts       nut-js simulation wrappers + synthetic-event guard
    keymap.ts      logical key name <-> nut-js / uiohook codes
    persistence.ts JSON load/save (debounced) in userData
  preload/       contextBridge security boundary (window.api)
  renderer/      React UI (no Node access; contextIsolation on)
    src/components/  one component per panel
    src/store.tsx    central state + IPC wiring
```

- **Input simulation:** [`@nut-tree-fork/nut-js`](https://github.com/nut-tree/nut.js)
- **Global input listening (record + hold):** [`uiohook-napi`](https://github.com/SnosMe/uiohook-napi)
- **Global hotkeys:** Electron's built-in `globalShortcut`
- Security: `contextIsolation: true`, `nodeIntegration: false`, a typed preload
  bridge, and a strict renderer CSP. No native modules are exposed to the renderer.

---

## Prerequisites

- **Windows 10/11**
- **Node.js 18+** (built/tested on Node 24)
- Build tools are **not** required for normal use — both native modules ship
  prebuilt N-API binaries that load directly in Electron.

## Install

```bash
npm install
```

Both native modules ship prebuilt **N-API** binaries (`uiohook-napi/prebuilds`
and `@nut-tree-fork/libnut-win32`), which are ABI-stable and load directly in
Electron — no Visual Studio / `node-gyp` build step is required. If you ever
need to rebuild from source (e.g. an unusual platform), install the
[Windows build tools](https://github.com/nodejs/node-gyp#on-windows) first.

## Run (development)

```bash
npm run dev
```

Hot-reloads the renderer; the main process restarts on change.

## Build a production bundle

```bash
npm run build       # compiles main / preload / renderer into out/
npm run preview     # runs the built app
```

## Package a Windows installer

```bash
npm run build:win   # produces an NSIS installer in release/
```

---

## How each mode behaves

| Mode | Trigger | What fires |
|------|---------|------------|
| **Manual** | Start button or toggle hotkey | All entries (+ enabled options + text) each cycle, honoring the Loop setting |
| **Sequence** | Manual, with Sequence Mode on | One entry per cycle, advancing through the list |
| **Hold-to-Spam** | Hold the configured key/button | Your whole list, repeatedly, until you release |
| **Focus Hold** | Hold the configured key/button | Only that one key/button, repeatedly, until you release |

- **Per-key delay** overrides the global **Default Delay**. Leave a row's delay
  blank to use the default.
- **Loop**: *Forever* runs until stopped; *Once* runs a single cycle; *N times*
  runs N cycles (a "cycle" = one full pass through the list).

## Hotkey notes

- Toggle and emergency hotkeys are global. They must be different from each
  other — the app flags the conflict if they match, and warns if the OS or
  another app already owns the chosen combo.
- The emergency key is only captured **while spamming**, so it doesn't swallow
  (e.g.) `Esc` system-wide the rest of the time.

## Known limitation

Hold-to-Spam / Focus-Hold detect physical key state via a global hook, which
also sees the app's own simulated input. The app suppresses its synthetic events
**per key**, so Hold-to-Spam (where the held key is never one being spammed)
starts and stops reliably.

**Focus Hold** is the exception: it fires the *same* key it watches, so a
release can occasionally coincide with a simulated press of that key and the
spam keeps going. If that happens, tap the key again or hit the emergency stop
(`Esc`). The toggle hotkey and Start/Stop button always work.

## Data location

Profiles and settings are stored at:

```
%APPDATA%\auto-spammer\autospammer-data.json
```

A starter profile (`resources/example-profile.json`) is included for reference;
the app seeds an equivalent default on first launch.

## License

MIT

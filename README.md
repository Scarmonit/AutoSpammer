<p align="center">
  <img src="docs/icon.png" alt="Monit" width="120" height="120" />
</p>

<h1 align="center">Monit</h1>

<p align="center">
  A fast, dark-themed <strong>auto key-presser, clicker &amp; macro recorder</strong> for Windows.<br/>
  Pick what to repeat and how fast, then hit your <strong>hotkey</strong> — or record a full
  keyboard&nbsp;+&nbsp;mouse macro and play it back on a loop.
</p>

<p align="center">
  <a href="https://github.com/Scarmonit/AutoSpammer/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/Scarmonit/AutoSpammer?label=version&sort=semver&style=flat-square&color=3b82f6" /></a>
  <a href="https://github.com/Scarmonit/AutoSpammer/releases"><img alt="Total downloads" src="https://img.shields.io/github/downloads/Scarmonit/AutoSpammer/total?style=flat-square&color=2f6fe0" /></a>
  <img alt="Windows 10 and 11" src="https://img.shields.io/badge/Windows-10%20%7C%2011-0a7bbb?style=flat-square" />
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-3ddc84?style=flat-square" /></a>
</p>

<!-- DOWNLOAD BUTTONS -->
<p align="center">
  <a href="https://github.com/Scarmonit/AutoSpammer/releases/latest/download/Monit-Portable-1.41.0.exe">
    <img src="https://img.shields.io/badge/Download%20Latest%20Version-Windows-3b82f6?style=for-the-badge&logo=windows&logoColor=white" alt="Download Latest Version (Windows)" height="46" />
  </a>
  &nbsp;
  <a href="https://github.com/Scarmonit/AutoSpammer/releases">
    <img src="https://img.shields.io/badge/View%20All%20Releases-GitHub-30363d?style=for-the-badge&logo=github&logoColor=white" alt="View All Releases" height="46" />
  </a>
</p>

<p align="center">
  <img src="docs/showcase-1.png" alt="Monit main window" width="900" />
</p>

---

## Download

No setup or extra tools required — each option is a single file you just run.

| Option | Best for | File |
| --- | --- | --- |
| **Portable** | Easiest — just run it. Nothing is installed. | **[Monit-Portable-1.41.0.exe](https://github.com/Scarmonit/AutoSpammer/releases/latest/download/Monit-Portable-1.41.0.exe)** |
| **Installer** | Adds Desktop and Start-menu shortcuts. | **[Monit-Setup-1.41.0.exe](https://github.com/Scarmonit/AutoSpammer/releases/latest/download/Monit-Setup-1.41.0.exe)** |

You can also open the **[latest release page](https://github.com/Scarmonit/AutoSpammer/releases/latest)** and grab either file under **Assets**.

> **First launch:** Windows may show a blue *"Windows protected your PC"* box because the app isn't code-signed. Click **More info**, then **Run anyway**. The app is open source and every line of code is in this repository.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Screenshots](#screenshots)
- [Usage Guide](#usage-guide)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Responsible Use](#responsible-use)
- [Troubleshooting](#troubleshooting)
- [Building From Source](#building-from-source)
- [Tech Stack and Architecture](#tech-stack-and-architecture)
- [License](#license)

---

## Quick Start

1. **Open Monit** from the Desktop or Start-menu shortcut.
2. In **Tap keys**, type a key to repeat — for example `a`, `space`, `1`, `f6`, or `numpad5`. Add more with **+ Add key**, or click **Record** and press keys to capture them automatically.
3. *(Optional)* Give any key its own delay in its row — a lower number is faster (the default is a very fast 10 ms).
4. **Click into the game or app** you want the input sent to, so it is the active window.
5. Press your **Start / stop hotkey** (default **F6**) anywhere — even while a game is focused — to start. Rebind it under **Options (⚙️) → Hotkeys**.
6. To stop: press the **Start / stop hotkey** again, or hit **Esc** for an emergency stop. You can also Start/Stop from the system-tray menu.

---

## Features

### Highlights

- **Global hotkey controls** — the **Start / stop** and **Emergency stop** hotkeys live under **Options → Hotkeys**; click a key chip to rebind it. Start and stop with the hotkey (default **F6**), the hold-action keys, or the system tray — there's no separate Start button to hunt for.
- **Profile and Loop toolbar** — a compact second row in the header holds the **Profile** picker (New / Save / Delete / Export / Load) and the **Loop** control (Forever / Play Once / Loop X times), so they're always one click away without taking up a panel.
- **Share profiles as files** — **Export** saves the current profile (every setting it stores) to a `.monit` file named after it; **Load** imports a shared file as a new profile and switches to it. Name clashes import as *"Name (2)"*, bad files show a clear error, and your other profiles are never touched.
- **Sections dropdown** — the **Sections ▾** button in the top bar opens a panel listing every section with its accent dot and an accent-colored switch. Toggle one off to completely hide it from the window *and* skip its feature when spamming; toggle it back to restore it in its saved position. Saved per profile.
- **Options dialog** — a gear button opens app settings: the Display toggles (hints, summary bar), **Text size**, the **Start / stop** and **Emergency stop** hotkey bindings, **Minimize to tray on close**, and **Reset layout**.
- **Full macro recording and playback** — capture everything (keys, clicks, and mouse movement) with the exact timing between events, edit any delay, then replay it on a loop.
- **Detection triggers** — watch a screen pixel (by color, with a tolerance) or a captured image (anywhere in a search area) and fire an action — press a key, click, or click a saved position — only while the condition matches on screen.
- **Drag-and-drop sections** — grab any section header to reorder it, even across the two columns. **Reset layout** (in Options) restores the default order.
- **Resizable sections** — drag the splitter between two panels to resize them; double-click to reset.
- **Collapsible sections** — collapse any panel to just its title bar with the header chevron.
- **Clean card-based UI** — every feature is its own rounded card with a colored accent dot, a friendly one-line description, and its own **toggle switch**: Tap keys, Timed key presses, Hold keys down, Hold triggers, Click positions, Text function, Macro, and Detection triggers.
- **WHEN RUNNING summary bar** — a live plain-English readout of what your setup will do (e.g. *"tap 2, 3 every 10 ms · press 1 every 5 s — loops forever"*), including only what's switched on. Toggle it — and the hint text — in **Options → Display**.
- **Independent enabling** — a switched-off card greys out (keeping its inner settings) and is skipped on the next run; switch it back on and everything resumes as it was.
- **Text size** — a dropdown under **Options → Display** zooms the whole app (100–200%) for readability; double-click it to type a custom percentage.
- **Remembers window size and position** — the app reopens exactly where and how big you left it.
- **Mouse buttons everywhere** — every key binding accepts a keyboard key *or* a mouse button (Left/Right Click, MMB, MB4, MB5).
- **Hotkey conflict prevention** — a key or mouse button can only drive one action; duplicate bindings are rejected with a clear message.
- **Full-screen key capture** — changing any binding dims and blurs the whole app and waits for your next key or mouse button (**Esc** cancels). Every hotkey is suspended while capturing, so pressing e.g. the start/stop key binds it instead of starting a run.

### Core

- **Tap any keys** — letters, digits, function keys, punctuation, and numpad, each with its own delay.
- **Click positions** — move to and click exact screen spots (left or right) every cycle.
- **Loop** — repeat forever, once, or a set number of times (in the header toolbar).
- **Hold keys down** + **Hold triggers** — keys/buttons held for the whole run, plus three hold-to-act modes that run only while you physically hold their key or button.
- **Timed key presses** — keys/buttons pressed on their own schedules, alongside the tapping.
- **Detection triggers** — pixel-color and image matching gate actions so they only fire when something appears on screen.
- **Profiles** — save and switch between different setups from the header toolbar; everything is remembered.
- **Global hotkeys** that work even while a game is focused, plus an **Esc** panic stop.
- **System tray** — runs in the background with close-to-tray.
- **Hardened Electron build** (sandbox, context isolation, fuses) — open source, no telemetry.

---

## Screenshots

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/showcase-1.png" alt="Main overview" /><br/>
      <sub><b>Main window</b> — Tap keys, Timed key presses, Hold keys down, and Hold triggers cards
      with their accent switches, plus the live <b>WHEN RUNNING</b> summary bar and the
      Profile picker, Loop control, and rebindable hotkeys in the header.</sub>
    </td>
    <td width="50%" valign="top">
      <img src="docs/showcase-2.png" alt="Cards collapsed and hold triggers" /><br/>
      <sub><b>Collapsible cards</b> — every card collapses to its title bar; the hold
      triggers each have their own switch with an inline key + delay row.</sub>
    </td>
  </tr>
</table>

---

## Usage Guide

### Tap keys

The **Tap keys** card rapidly taps everything in its list, together, the whole time a run is active. Keys show as chips, each with its own optional delay. Use **+ Add key** (or **Record**) to build the list, and check **Space**, **Left Click**, or **Right Click** to include the spacebar or a mouse button — uncheck to stop tapping it. The checkboxes are saved with the profile.

### Timed key presses

The **Timed key presses** card presses each key or mouse button on its **own schedule** (e.g. **1** every 5s *and* **MB4** every 2s), running alongside the tapping. Each row reads *Press [key] every [n] sec* — click the key chip to capture a new binding — and **+ Add timed press** adds another.

### Hold keys down

Keys *or* mouse buttons held down non-stop while running (not tapped), e.g. hold **W** to keep walking. Use **+ Add key**, or the **Left Click** / **Right Click** chips to toggle a mouse button in and out of the held list.

### Hold triggers

Nothing in this card runs on its own — things only happen **while you physically hold** a key or button (watched globally, so it works even while a game is focused). Each trigger has its own switch plus an inline *Hold [key] delay [ms]* row:

- **Hold to spam everything** — while held, runs your whole tap list. Release to stop.
- **Hold to rapid-fire one key** — while held, fires just this key as fast as the delay allows.
- **Hold to rapid right-click** — while held, right-clicks over and over.

### The WHEN RUNNING summary bar

Under the profile row, the **WHEN RUNNING** bar describes your current setup in plain English — e.g. *"tap 2, 3 every 10 ms · press 1 every 5 s · hold Right Click down — loops forever"*. It updates live as you change settings and only includes cards that are switched on. Hide it (or the hint text under each card title) from **Options → Display**.

### Every card has its own switch

Each card's header switch controls whether that card participates in a run — a switched-off card greys out (its inner settings keep their state) and is skipped. All switches are saved per profile.

### Click Positions (record and click specific spots)

To click exact places on screen rather than just where your cursor is, add spots in any of three ways:

1. **One at a time** — aim your mouse at a spot and press **F7** (or click **+ Add position**). This works even while a game is focused, so you can record several spots without alt-tabbing.
2. **Record clicks** — click **Record clicks**, and every left or right click anywhere on screen is saved automatically as a position with the correct button. Click **Stop recording** when done. Clicks on the Monit window itself are ignored.
3. Each recorded spot shows its coordinates and an **L/R** button to switch between left and right click. Give it its own delay, or remove it.

When a run starts, the cursor moves to each recorded spot and clicks it, in order, every cycle. The single-spot record hotkey (default **F7**) can be changed in that panel.

### Macro (full keyboard and mouse recording)

The **Macro** section records everything — every keystroke, every mouse click, and the mouse path — with the exact timing between each event, then plays it all back.

1. *(Optional)* Click **Record hotkey** to choose a key (default **F10**) that starts and stops recording from anywhere, even while a game is focused.
2. Click **Record** (or press the hotkey), do your actions, then press the hotkey again (or **Stop Recording**). The key you press to stop is never included, and clicks on the Monit window are ignored.
3. The captured events are listed with the delay before each one. Edit any delay to speed a step up or slow it down.
4. Run it like any other spam: flip the section's **Enabled** switch, then start a run with your **Toggle Hotkey** (**F6**). The macro plays back with your exact timings and repeats according to the **Loop** control in the header toolbar.
5. The panel's **Play once** button is a quick one-shot preview; **Stop** cancels it, **Clear** wipes the recording, and **Save** writes it to the current profile.

Macro is mutually exclusive with Tap keys and Click positions: enabling Macro turns those two off, and turning either back on turns Macro off. The recording is saved with the profile.

> **Tip:** pick a record hotkey you don't otherwise use in your game (F10 by default) — it's detected globally, so it also reaches the focused app.

### Detection triggers (act only when something appears on screen)

The **Detection triggers** card is a *gate*: while a run is active it watches the screen and fires each trigger's action **only while its condition matches**. Nothing fires when the color or image isn't there.

Each trigger row has two halves:

1. **When** — pick the match mode:
   - **pixel color** — click **Pick pixel**, then left-click any spot on screen (even in a game). The pixel's position and color are captured and shown as a swatch with its hex value. The **±** field is the tolerance per RGB channel (0 = exact match; 10 forgives slight shading).
   - **image appears** — click **Capture image**, then left-click two opposite corners of the thing to look for (a captured thumbnail appears). By default the whole screen is searched; **Search: screen** lets you click two corners to limit the search area (faster, fewer false hits), and its **×** resets to full screen. The same **±** tolerance applies per pixel.
2. **then** — the action to run on a match: **press a key** (click the chip to capture one), **left click** / **right click** at the current cursor position, or **click a saved position** from the Click positions card.

Each row has its own switch, and the card's header switch gates them all — both must be on, and only during a run (started with **F6**, the tray, or a hold trigger). **check every [n] ms** sets how often the screen is polled (250 ms default; lower is snappier but uses more CPU). While a trigger matches, its action fires once per check. Everything is saved with the profile and included in `.monit` exports.

> **Tip:** for "click the button when it turns green", use **pixel color** on a pixel inside the button plus a **click a saved position** action — it's much cheaper than image matching.

### System tray

Monit lives in the system tray so it stays out of your way while you game. By default, closing the window minimizes it to the tray (it keeps running and global hotkeys still work). Right-click the tray icon to **Show**, **Start/Stop Spam**, **Panic Stop**, or **Quit**. Left-click the icon to bring the window back. You can make the close button quit instead in the **Options** dialog.

### Layout: resize, collapse, hide, and reorder

- **Resize** — hover the thin gap between two sections (the cursor becomes a resize arrow) and drag up or down. Double-click the splitter to reset that section to its natural size.
- **Collapse** — click the chevron in a section header to collapse it to just the title bar; click again to expand.
- **Hide** — use the **Sections ▾** dropdown in the top bar to remove a section entirely and skip its feature on the next run.
- **Reorder** — drag a section by its header grip to a new spot, within a column or across both. Use **Reset layout** (in Options) to restore the default order.

All layout choices — sizes, collapsed state, hidden state, and order — are saved per profile.

### Handy extras

- **Space / Left Click / Right Click checkboxes** — add those to the tap list without typing.
- **Profiles** — save different setups and switch between them; they persist across restarts.
- **Options → Display** — hide the hint text and/or the WHEN RUNNING summary bar for a denser UI.

---

## Keyboard Shortcuts

All shortcuts are rebindable in the app. The **Start / stop** and **Emergency stop** keys live under **Options (⚙️) → Hotkeys** — click a key chip to rebind; the rest live in their own sections.

| Key | Action |
| --- | --- |
| **F6** | Start / stop hotkey — toggles the whole run (rebind in Options) |
| **F7** | Record current mouse position |
| **F10** | Start / stop macro recording |
| **Esc** | Emergency stop — stops everything and releases held keys (rebind in Options) |

> **No double-binding:** every hotkey and hold-trigger key shares one pool, so a key or mouse button can only drive one action. If you try to assign one that's already in use, the change is rejected with a clear message such as *"The key F is already bound to Focus Hold Key."*

---

## Responsible Use

Monit sends real keyboard and mouse input to whatever window is focused. **Many online and competitive games forbid input automation and may ban your account.** Only use it where automation is allowed — single-player games, your own applications, accessibility, testing, and similar. You are responsible for how you use it.

---

## Troubleshooting

- **"Windows protected your PC" popup** — click **More info**, then **Run anyway**. This only appears because the app isn't signed with a paid certificate.
- **Keys go to the wrong window** — click into the target window first; Monit sends input to whatever is focused.
- **It won't stop** — press **Esc**, or press your **Toggle Hotkey** (**F6**), or use the tray's Stop.
- **Antivirus flags it** — key-pressers look like automation tools to antivirus software, so false positives can happen. The full source is in this repository if you'd prefer to build it yourself.

---

## Building From Source

Only needed if you want to modify the app or build the installer yourself.

**Requirements:** [Node.js](https://nodejs.org/) 18+ (built on Node 24) and Windows 10/11. No Visual Studio needed — the native modules ship prebuilt binaries.

```bash
git clone https://github.com/Scarmonit/AutoSpammer.git
cd AutoSpammer
npm install          # download dependencies

npm run dev          # run the app in development (hot reload)
npm run build:win    # build the installer -> release/Monit-Setup-<version>.exe
npm run icons        # regenerate icons from build/icon-source.png
```

### Testing

Automated tests follow Electron's [testing guidance](https://www.electronjs.org/docs/latest/tutorial/automated-testing):

```bash
npm run typecheck    # TypeScript, no emit
npm test             # Vitest unit tests (engine, macro, bindings, keymap, defaults, sections)
npm run test:e2e     # builds, then Playwright drives the real Electron app
npm run test:all     # typecheck + unit + e2e
```

- **Unit tests** (`tests/unit/`, Vitest) cover the pure logic — the spam engine (loop modes, sequence mode, options/positions/text, focus-hold, macro playback), the macro recorder/player, binding-conflict detection, key-name mappings, section layout/visibility helpers, and the default data — all with the native input layer mocked.
- **End-to-end tests** (`tests/e2e/`, Playwright) launch the built app via `_electron.launch` and assert the UI, IPC, and persistence wiring.
- CI runs all of the above on every push (`.github/workflows/test.yml`), using `xvfb` so the Electron window runs headless on Linux.

### Debugging

`.vscode/launch.json` includes ready-to-use configs (see Electron's [debugging docs](https://www.electronjs.org/docs/latest/tutorial/application-debugging)):

- **Debug Main Process** — builds, then launches Electron under the Node debugger.
- **Debug Unit Tests (Vitest)** — run or break in the unit tests.
- For the **renderer**, open DevTools in the running app (`Ctrl+Shift+I`).

---

## Tech Stack and Architecture

Built with **Electron + React + TypeScript** via [`electron-vite`](https://electron-vite.org/).

```
src/
  shared/    types, IPC channel names, default profile, binding-conflict + section rules
  main/      Electron main process: window, IPC, input validation
    engine.ts      cancellable spam + macro loop (runs off the UI thread)
    macro.ts       macro recorder + player (timing, exclusions, playback)
    hotkeys.ts     global hotkeys + uiohook (record / hold detection)
    input.ts       nut-js input simulation + synthetic-event accounting
    keymap.ts      logical key name <-> nut-js / uiohook codes
    persistence.ts profiles saved as JSON in %APPDATA%\auto-spammer
  preload/   secure contextBridge (window.api)
  renderer/  React UI (one component per panel, resizable + collapsible sections)
```

**Libraries**

- **Input simulation:** [`@nut-tree-fork/nut-js`](https://github.com/nut-tree/nut.js)
- **Global input listening:** [`uiohook-napi`](https://github.com/SnosMe/uiohook-napi)
- **Global hotkeys:** Electron `globalShortcut`

**Security hardening** — follows the Electron security checklist (audited with [Electronegativity](https://github.com/doyensec/electronegativity)):

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and a typed `contextBridge` preload — the renderer gets no Node or Electron access beyond the small `window.api` surface.
- Strict renderer CSP (`script-src 'self'`).
- `setWindowOpenHandler` denies in-app windows and only opens http/https URLs externally; `will-navigate` is blocked; all permission requests are denied.
- [Electron Fuses](https://www.electronjs.org/docs/latest/tutorial/fuses) flipped at package time (`build/afterPack.cjs`): `RunAsNode` off, `EnableNodeOptionsEnvironmentVariable` off, `EnableNodeCliInspectArguments` off, `EnableCookieEncryption` on, `OnlyLoadAppFromAsar` on — so the shipped binary can't be repurposed as a generic Node runtime or have debug flags injected.
- Native modules are unpacked from the asar (`asarUnpack`) so their `.node` binaries load correctly.

**How hold detection stays reliable** — a physically held key produces auto-repeat key-downs but no key-up until you release it. The app records every synthetic key-up it emits and matches them off as the global hook reports them, so an unaccounted key-up is unambiguously your real release. This is what makes Hold-to-Spam and Focus Hold stop reliably even while spamming the same key.

**Icon** — the artwork lives in [`build/icon-source.png`](build/icon-source.png); `npm run icons` regenerates every derived size (the Windows `.exe` and installer icon, the window title-bar icon, the README logo, and the embedded system-tray icon) with no image tools required.

---

## License

MIT — see [LICENSE](LICENSE).

<p align="center">
  <img src="docs/icon.png" alt="Auto Spammer" width="120" height="120" />
</p>

<h1 align="center">Auto Spammer</h1>

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
  <a href="https://github.com/Scarmonit/AutoSpammer/releases/latest/download/AutoSpammer-Portable-1.32.0.exe">
    <img src="https://img.shields.io/badge/Download%20Latest%20Version-Windows-3b82f6?style=for-the-badge&logo=windows&logoColor=white" alt="Download Latest Version (Windows)" height="46" />
  </a>
  &nbsp;
  <a href="https://github.com/Scarmonit/AutoSpammer/releases">
    <img src="https://img.shields.io/badge/View%20All%20Releases-GitHub-30363d?style=for-the-badge&logo=github&logoColor=white" alt="View All Releases" height="46" />
  </a>
</p>

<p align="center">
  <img src="docs/showcase-1.png" alt="Auto Spammer main window" width="900" />
</p>

---

## Download

No setup or extra tools required — each option is a single file you just run.

| Option | Best for | File |
| --- | --- | --- |
| **Portable** | Easiest — just run it. Nothing is installed. | **[AutoSpammer-Portable-1.32.0.exe](https://github.com/Scarmonit/AutoSpammer/releases/latest/download/AutoSpammer-Portable-1.32.0.exe)** |
| **Installer** | Adds Desktop and Start-menu shortcuts. | **[AutoSpammer-Setup-1.32.0.exe](https://github.com/Scarmonit/AutoSpammer/releases/latest/download/AutoSpammer-Setup-1.32.0.exe)** |

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

1. **Open Auto Spammer** from the Desktop or Start-menu shortcut.
2. In **Keys to Spam**, type a key to repeat — for example `a`, `space`, `1`, `f6`, or `numpad5`. Add more with **+ Add Key**, or click **Record** and press keys to capture them automatically.
3. *(Optional)* Set the speed under **Default Delay** — a lower number is faster (10 ms is very fast). Each key can have its own delay too.
4. **Click into the game or app** you want the input sent to, so it is the active window.
5. Press your **Toggle Hotkey** (default **F6**) anywhere — even while a game is focused — to start. The current hotkey is shown in the top bar; click it to rebind.
6. To stop: press the **Toggle Hotkey** again, or hit **Esc** for an emergency stop. You can also Start/Stop from the system-tray menu.

---

## Features

### Highlights

- **Top-bar hotkey controls** — the global **Toggle** and **Emergency-stop** hotkeys live right in the top bar; click either to rebind it. Start and stop with the Toggle Hotkey (default **F6**), the hold-action keys, or the system tray — there's no separate Start button to hunt for.
- **Profile and Loop toolbar** — a compact second row in the header holds the **Profile** picker (with New / Rename / Save / Delete) and the **Loop** control (Forever / Play Once / Loop X times), so they're always one click away without taking up a panel.
- **Sections manager** — an eye button in the top bar opens a popup listing every section with a checkbox. Uncheck one to completely hide it from the window *and* skip its feature when spamming; re-check to bring it back in its saved position. Saved per profile.
- **Options dialog** — a gear button opens app settings. Toggle *"Minimize to system tray when closing the window"*: on (default) keeps Auto Spammer running in the tray when you press the close button; off makes the close button fully quit the app.
- **Full macro recording and playback** — capture everything (keys, clicks, and mouse movement) with the exact timing between events, edit any delay, then replay it on a loop.
- **Drag-and-drop sections** — grab any section header to reorder it, even across the two columns. A **Reset Layout** button restores the default order.
- **Resizable sections** — drag the splitter between two panels to resize them; double-click to reset.
- **Collapsible sections** — collapse any panel to just its title bar with the header chevron.
- **Keys to Spam** — the key list with its quick options, plus the **periodic press list** inlined right below them for timed presses. **Hold Actions** is its own separate section (Hold Keys Down + the three hold-trigger modes). A dot on an accordion / mode header marks anything that's enabled.
- **Independent enabling** — *every* section has an **Enabled** switch in its header (shown even when the section is collapsed). Keys to Spam and Hold Actions add one too, as a master switch for the whole group, while their inner parts keep their own toggles. A disabled feature greys out and is skipped on the next run.
- **UI scale** — a top-bar dropdown zooms the whole app (100–200%) for readability; double-click to type a custom percentage.
- **Remembers window size and position** — the app reopens exactly where and how big you left it.
- **Mouse buttons everywhere** — every key binding accepts a keyboard key *or* a mouse button (LMB, RMB, MMB, MB4, MB5).
- **Hotkey conflict prevention** — a key or mouse button can only drive one action; duplicate bindings are rejected with a clear message.

### Core

- **Spam any keys** — letters, digits, function keys, punctuation, and numpad, each with its own delay, in parallel or one-at-a-time **Sequence Mode**.
- **Click positions** — move to and click exact screen spots (left or right) every cycle.
- **Loop** — repeat forever, once, or a set number of times (in the header toolbar).
- **Hold Actions** — its own section: Hold Keys Down plus Hold-to-Spam, Focus Hold, and Hold for Right-Click; each hold trigger runs only while you physically hold its chosen key or button.
- **Periodic** — keys/buttons on their own timers (inlined in Keys to Spam, below the spam options).
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
      <sub><b>Main window</b> — Keys to Spam (with a Periodic Actions accordion), the
      separate Hold Actions section, and Click Positions, with the Profile picker, Loop
      control, and rebindable hotkeys in the header toolbar.</sub>
    </td>
    <td width="50%" valign="top">
      <img src="docs/showcase-2.png" alt="Macro section and triggers" /><br/>
      <sub><b>Macro and triggers</b> — full recording with editable per-event delays and a
      live event list, alongside Focus Hold and Hold for Right-Click.</sub>
    </td>
  </tr>
</table>

---

## Usage Guide

### Keys to Spam

The **Keys to Spam** section holds the key list itself, the Spacebar / Left Click / Right Click options, **Default Delay**, **Sequence Mode**, and the live **"Will spam"** preview. Its **Enabled** switch controls whether the key list spams.

Directly below those options sits the **periodic press list**: press any number of keys or mouse buttons on their **own independent timers** (e.g. **F** every 5s *and* **MB4** every 2s). Use **+ Add Periodic Key**, **Set Key** to bind each, and set its interval. It has its own **Enabled** switch and runs alongside a normal run.

### Hold Actions

The **Hold Actions** section gathers everything you trigger by *holding* a key or button. Each part has its own **Enabled** switch and is watched globally, so it works even while a game is focused.

- **Hold Keys Down** — hold keys *or* mouse buttons down continuously (not tapped), e.g. hold **W** to keep walking. Use **+ Add Key**, or **+ Left Click** / **+ Right Click** for a mouse button. Held automatically for the whole run.
- **Hold-to-Spam** — while you hold the chosen key, it runs the whole spam system and stops when you release.
- **Focus Hold** — hold a key to rapidly fire only that same key or button.
- **Hold for Right-Click** — hold the trigger to rapidly right-click; release to stop.

Each hold trigger has its own **Set Key** and delay.

### Enable or disable Keys and Click Positions independently

**Keys to Spam** and **Click Positions** each have their own **Enabled** switch, so you can spam only keys, only click positions, or both. If you turn both off, starting a run does nothing and shows a quick warning. These switches are saved per profile.

### Click Positions (record and click specific spots)

To click exact places on screen rather than just where your cursor is, add spots in any of three ways:

1. **One at a time** — aim your mouse at a spot and press **F7** (or click **+ Add Current Mouse Position**). This works even while a game is focused, so you can record several spots without alt-tabbing.
2. **Record Clicks** — click **Record Clicks**, and every left or right click anywhere on screen is saved automatically as a position with the correct button. Click **Stop Recording** when done. Clicks on the Auto Spammer window itself are ignored.
3. Each recorded spot shows its coordinates and an **L/R** button to switch between left and right click. Give it its own delay, or remove it.

When a run starts, the cursor moves to each recorded spot and clicks it, in order, every cycle. The single-spot record hotkey (default **F7**) can be changed in that panel.

### Macro (full keyboard and mouse recording)

The **Macro** section records everything — every keystroke, every mouse click, and the mouse path — with the exact timing between each event, then plays it all back.

1. *(Optional)* Click **Set Record Hotkey** to choose a key (default **F10**) that starts and stops recording from anywhere, even while a game is focused.
2. Click **Record** (or press the hotkey), do your actions, then press the hotkey again (or **Stop Recording**). The key you press to stop is never included, and clicks on the Auto Spammer window are ignored.
3. The captured events are listed with the delay before each one. Edit any delay to speed a step up or slow it down.
4. Run it like any other spam: flip the section's **Enabled** switch, then start a run with your **Toggle Hotkey** (**F6**). The macro plays back with your exact timings and repeats according to the **Loop** control in the header toolbar.
5. The panel's **Play once** button is a quick one-shot preview; **Stop** cancels it, **Clear** wipes the recording, and **Save** writes it to the current profile.

Macro is mutually exclusive with Spam Keys and Click Positions: enabling Macro turns those two off, and turning either back on turns Macro off. The recording is saved with the profile.

> **Tip:** pick a record hotkey you don't otherwise use in your game (F10 by default) — it's detected globally, so it also reaches the focused app.

### System tray

Auto Spammer lives in the system tray so it stays out of your way while you game. By default, closing the window minimizes it to the tray (it keeps running and global hotkeys still work). Right-click the tray icon to **Show**, **Start/Stop Spam**, **Panic Stop**, or **Quit**. Left-click the icon to bring the window back. You can make the close button quit instead in the **Options** dialog.

### Layout: resize, collapse, hide, and reorder

- **Resize** — hover the thin gap between two sections (the cursor becomes a resize arrow) and drag up or down. Double-click the splitter to reset that section to its natural size.
- **Collapse** — click the chevron in a section header to collapse it to just the title bar; click again to expand.
- **Hide** — use the **Sections** manager (eye button in the top bar) to remove a section entirely and skip its feature on the next run.
- **Reorder** — drag a section by its header grip to a new spot, within a column or across both. Use **Reset Layout** to restore the default order.

All layout choices — sizes, collapsed state, hidden state, and order — are saved per profile.

### Handy extras

- **Spacebar / Left Click / Right Click** checkboxes — add those without typing.
- **Sequence Mode** — fire your keys one at a time per cycle instead of all at once.
- **Profiles** — save different setups and switch between them; they persist across restarts.

---

## Keyboard Shortcuts

All shortcuts are rebindable in the app. The **Toggle** and **Emergency-stop** keys are shown in the top bar — click either to rebind; the rest live in their own sections.

| Key | Action |
| --- | --- |
| **F6** | Toggle Hotkey — start / stop spamming (rebind in the top bar) |
| **F7** | Record current mouse position |
| **F10** | Start / stop macro recording |
| **Esc** | Emergency stop — stops everything and releases held keys (rebind in the top bar) |

> **No double-binding:** every hotkey and hold-trigger key shares one pool, so a key or mouse button can only drive one action. If you try to assign one that's already in use, the change is rejected with a clear message such as *"The key F is already bound to Focus Hold Key."*

---

## Responsible Use

Auto Spammer sends real keyboard and mouse input to whatever window is focused. **Many online and competitive games forbid input automation and may ban your account.** Only use it where automation is allowed — single-player games, your own applications, accessibility, testing, and similar. You are responsible for how you use it.

---

## Troubleshooting

- **"Windows protected your PC" popup** — click **More info**, then **Run anyway**. This only appears because the app isn't signed with a paid certificate.
- **Keys go to the wrong window** — click into the target window first; Auto Spammer sends input to whatever is focused.
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
npm run build:win    # build the installer -> release/AutoSpammer-Setup-<version>.exe
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

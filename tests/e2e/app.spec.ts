import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page, Locator } from '@playwright/test'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// Launches the built Electron app (package.json "main" -> out/main/index.js).
// A throwaway --user-data-dir keeps the test from touching real profiles and
// gives it its own single-instance lock, so it can run alongside a dev session.
// Tests deliberately do NOT press Start / hold / periodic, since those send real
// OS input — we assert the UI, IPC, and persistence wiring instead.
let app: ElectronApplication
let win: Page

/** A panel scoped by its exact heading (matching body text must not interfere). */
const section = (heading: string): Locator =>
  win.locator('.section').filter({ has: win.getByRole('heading', { name: heading, exact: true }) })

test.beforeAll(async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'autospammer-e2e-'))
  app = await electron.launch({ args: ['.', `--user-data-dir=${userDataDir}`] })
  win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  // The app uses close-to-tray, so closing the window only hides it. Force a
  // real exit for the test teardown.
  await app?.evaluate(({ app }) => app.exit(0)).catch(() => {})
  await app?.close().catch(() => {})
})

test('window title is "Auto Spammer"', async () => {
  expect(await win.title()).toBe('Auto Spammer')
})

test('main process is reachable via evaluate()', async () => {
  const name = await app.evaluate(async ({ app }) => app.getName())
  expect(name).toBe('auto-spammer')
})

test('renders all the core panels', async () => {
  for (const heading of [
    'Keys to Spam',
    'Hold Actions',
    'Click Positions',
    'Text Function',
    'Macro'
  ]) {
    await expect(win.getByRole('heading', { name: heading, exact: true })).toBeVisible()
  }
  // Merged/moved sections no longer have standalone headings.
  for (const gone of [
    'Options',
    'Toggle Hotkey',
    'Profiles',
    'Loop',
    'Keys & Actions',
    'Hold Modes',
    'Hold Keys Down',
    'Periodic Key'
  ]) {
    await expect(win.getByRole('heading', { name: gone, exact: true })).toHaveCount(0)
  }
  // No big Start Spam button.
  await expect(win.locator('.startbtn')).toHaveCount(0)
})

test('Keys to Spam has Spam Keys + Periodic Actions accordions (no Hold Actions inside)', async () => {
  const keys = section('Keys to Spam')
  const accs = keys.locator('.acc')
  await expect(accs).toHaveCount(2)
  await expect(keys.locator('.acc__title', { hasText: 'Spam Keys' })).toBeVisible()
  await expect(keys.locator('.acc__title', { hasText: 'Periodic Actions' })).toBeVisible()
  // Hold Actions is no longer an accordion inside Keys to Spam.
  await expect(keys.locator('.acc__title', { hasText: 'Hold Actions' })).toHaveCount(0)
  // Spam Keys is expanded by default; Periodic is collapsed.
  await expect(keys.locator('.acc', { hasText: 'Spam Keys' })).toHaveClass(/acc--open/)
  await expect(keys.locator('.keylist__summary')).toBeVisible()
  await expect(keys.locator('.acc', { hasText: 'Periodic Actions' })).not.toHaveClass(/acc--open/)
})

test('Hold Actions is its own top-level section with Hold Keys + the three modes', async () => {
  const hold = section('Hold Actions')
  await expect(hold).toBeVisible()
  // Hold Keys Down list controls.
  await expect(hold.getByRole('button', { name: '+ Add Key' })).toBeVisible()
  await expect(hold.getByRole('button', { name: '+ Left Click' })).toBeVisible()
  await expect(hold.getByRole('button', { name: 'Hold', exact: true })).toBeVisible()
  // The three hold-trigger mode cards, each with its own Set Key + Enable toggle.
  await expect(hold.locator('.holdmode--card')).toHaveCount(3)
  await expect(hold.getByRole('button', { name: 'Set Key' })).toHaveCount(3)
  await expect(hold.locator('.holdmode .section__toggle input')).toHaveCount(3)
  for (const t of ['Hold-to-Spam', 'Focus Hold', 'Hold for Right-Click']) {
    await expect(hold.locator('.holdmode__title', { hasText: t })).toBeVisible()
  }
})

test('Keys to Spam and Hold Actions show a header Enabled toggle, even collapsed', async () => {
  for (const name of ['Keys to Spam', 'Hold Actions']) {
    const sec = section(name)
    // A single master toggle in the section header (not the inner feature toggles).
    const headToggle = sec.locator('.section__head-actions .section__toggle input')
    await expect(headToggle).toHaveCount(1)
    await expect(headToggle).toBeVisible()
    await expect(headToggle).toBeChecked() // sections are enabled by default

    // Collapse the section — the header toggle stays visible and usable.
    await sec.locator('.section__collapse').click()
    await expect(sec).toHaveClass(/section--collapsed/)
    await expect(headToggle).toBeVisible()

    // Toggling it off (while collapsed) dims the body once re-expanded; toggle back on.
    await headToggle.uncheck()
    await expect(headToggle).not.toBeChecked()
    await sec.locator('.section__collapse').click() // expand
    await expect(sec.locator('.section__body')).toHaveClass(/section__body--off/)
    await headToggle.check()
    await expect(sec.locator('.section__body')).not.toHaveClass(/section__body--off/)
  }
})

test('the Profile and Loop controls live in the header toolbar', async () => {
  const subbar = win.locator('.subbar')
  // Profile picker + actions.
  const profile = subbar.locator('.subbar__group').filter({ hasText: 'Profile' })
  await expect(profile.locator('select')).toBeVisible()
  for (const name of ['New', 'Rename', 'Save', 'Delete']) {
    await expect(profile.getByRole('button', { name, exact: true })).toBeVisible()
  }
  await expect(profile.locator('select option')).toContainText(['Default'])

  // Loop mode dropdown with the three modes.
  const loopSelect = subbar.locator('.subbar__group').filter({ hasText: 'Loop' }).locator('select')
  await expect(loopSelect).toBeVisible()
  await expect(loopSelect.locator('option')).toHaveCount(3)
})

test('the merged Options controls live inside Keys to Spam (Spam Keys)', async () => {
  const keys = section('Keys to Spam')
  // Spacebar / clicks, Default Delay, and Sequence Mode now sit in this section.
  await expect(keys.locator('.check', { hasText: 'Spacebar' })).toBeVisible()
  await expect(keys.locator('.check', { hasText: 'Left Mouse Click' })).toBeVisible()
  await expect(keys.locator('.check', { hasText: 'Right Mouse Click' })).toBeVisible()
  await expect(keys.locator('.check', { hasText: 'Sequence Mode' })).toBeVisible()
  await expect(keys.locator('.field', { hasText: 'Default Delay' })).toBeVisible()
})

test('seeds the default profile keys and a "Will spam" summary', async () => {
  const keys = section('Keys to Spam')
  await expect(keys.locator('.keyrow__key').first()).toHaveValue('space')
  await expect(keys.locator('.keylist__summary')).toContainText('Will spam:')
})

test('can add and edit a key row (reflected in the summary)', async () => {
  const keys = section('Keys to Spam')
  const rows = keys.locator('.keyrow')
  const before = await rows.count()

  await keys.getByRole('button', { name: '+ Add Key' }).click()
  await expect(rows).toHaveCount(before + 1)

  const newKey = keys.locator('.keyrow__key').last()
  await newKey.fill('r')
  await expect(newKey).toHaveValue('r')
  await expect(keys.locator('.chip', { hasText: 'R' })).toBeVisible()
})

test('Click Positions exposes the Record Clicks button', async () => {
  const positions = section('Click Positions')
  await expect(positions.getByRole('button', { name: '+ Add Current Mouse Position' })).toBeVisible()
  await expect(positions.getByRole('button', { name: '● Record Clicks' })).toBeVisible()
})

test('renders draggable splitters between sections', async () => {
  // Columns of 2 (left) and 3 (right) sections -> 1 + 2 = 3 splitters (last pane
  // per column has none).
  const splitters = win.locator('.rs-splitter')
  await expect(splitters).toHaveCount(3)
  await expect(splitters.first()).toHaveCSS('cursor', 'ns-resize')
})

test('Macro section exposes record + set-hotkey controls', async () => {
  const macro = section('Macro')
  await expect(macro.getByRole('button', { name: '● Record' })).toBeVisible()
  await expect(macro.getByRole('button', { name: /Set Record Hotkey/ })).toBeVisible()
  await expect(macro.getByRole('button', { name: '▶ Play once' })).toBeVisible()
})

test('enabling Macro disables Keys to Spam and Click Positions', async () => {
  const macro = section('Macro')
  // The Spam Keys accordion (open by default) holds the enable-keys toggle.
  const keysToggle = section('Keys to Spam')
    .locator('.acc', { hasText: 'Spam Keys' })
    .locator('.section__toggle input')
  const posToggle = section('Click Positions').locator('.section__toggle input')

  // Make sure the spam sources start enabled.
  if (!(await keysToggle.isChecked())) await keysToggle.check()
  if (!(await posToggle.isChecked())) await posToggle.check()

  await macro.locator('.section__toggle input').check()
  await expect(keysToggle).not.toBeChecked()
  await expect(posToggle).not.toBeChecked()

  // Re-enabling a spam source turns Macro back off.
  await keysToggle.check()
  await expect(macro.locator('.section__toggle input')).not.toBeChecked()
})

test('the global Toggle and Emergency hotkeys live in the top bar', async () => {
  const bar = win.locator('.topbar__hotkeys')
  await expect(bar.getByRole('button', { name: /^Toggle:/ })).toBeVisible()
  await expect(bar.getByRole('button', { name: /^Stop:/ })).toBeVisible()
})

test('only one hotkey capture is active at a time (top bar)', async () => {
  const bar = win.locator('.topbar__hotkeys')

  await bar.getByRole('button', { name: /^Toggle:/ }).click()
  await expect(bar.locator('.btn--listening')).toHaveCount(1)
  // Listening state tells the user mouse buttons are accepted too.
  await expect(bar.locator('.btn--listening')).toHaveText('Press a key or mouse button…')

  // Starting the Emergency capture must cancel the first one (not bind to both).
  await bar.getByRole('button', { name: /^Stop:/ }).click()
  await expect(bar.locator('.btn--listening')).toHaveCount(1)

  // Clicking the active button again cancels capture.
  await bar.locator('.btn--listening').click()
  await expect(bar.locator('.btn--listening')).toHaveCount(0)
})

test('the Escape key can be bound to the top-bar toggle hotkey', async () => {
  const bar = win.locator('.topbar__hotkeys')

  // Move Emergency off Escape (to F1) so Escape is free to assign.
  await bar.getByRole('button', { name: /^Stop:/ }).click()
  await win.keyboard.press('F1')
  await expect(bar.getByRole('button', { name: 'Stop: F1' })).toBeVisible()

  // Escape now binds to the toggle normally instead of cancelling the capture.
  await bar.getByRole('button', { name: /^Toggle:/ }).click()
  await win.keyboard.press('Escape')
  await expect(bar.getByRole('button', { name: 'Toggle: Escape' })).toBeVisible()
})

test('Hold Actions section: Hold Keys Down + Add Key adds a row and a mouse chip', async () => {
  const hold = section('Hold Actions')

  // Hold Keys Down: + Add Key adds a row that accepts a key...
  const rows = hold.locator('.keyrow')
  const before = await rows.count()
  await hold.getByRole('button', { name: '+ Add Key' }).click()
  await expect(rows).toHaveCount(before + 1)
  const newKey = hold.locator('.keyrow__key').last()
  await newKey.fill('w')
  await expect(newKey).toHaveValue('w')

  // ...and a mouse button can be added as a static chip.
  await hold.getByRole('button', { name: '+ Left Click' }).click()
  await expect(hold.locator('.keyrow__static', { hasText: 'LMB' })).toBeVisible()
})

test('Keys to Spam → Periodic Actions accordion: multi-entry list with timers', async () => {
  const keys = section('Keys to Spam')
  const perAcc = keys.locator('.acc', { hasText: 'Periodic Actions' })
  await perAcc.locator('.acc__head').click()
  await expect(perAcc).toHaveClass(/acc--open/)
  await expect(perAcc.locator('.section__toggle input')).toBeVisible()

  const rows = perAcc.locator('.periodicrow')
  const before = await rows.count()
  await perAcc.getByRole('button', { name: '+ Add Periodic Key' }).click()
  await expect(rows).toHaveCount(before + 1)
  await expect(rows.last().locator('.periodicrow__interval')).toBeVisible()

  await perAcc.locator('.acc__head').click()
  await expect(perAcc).not.toHaveClass(/acc--open/)
})

test('every section can be hidden/shown via its header toggle', async () => {
  // 2 sections (left) + 3 sections (right) = 5 collapse buttons.
  await expect(win.locator('.section__collapse')).toHaveCount(5)

  const keys = section('Keys to Spam')
  await expect(keys.locator('.section__body')).toBeVisible()

  await keys.locator('.section__collapse').click()
  await expect(keys).toHaveClass(/section--collapsed/)
  await expect(keys.locator('.section__body')).toBeHidden()

  await keys.locator('.section__collapse').click()
  await expect(keys.locator('.section__body')).toBeVisible()
})

test('the top bar UI scale is a dropdown that double-clicks into a custom input', async () => {
  const select = win.locator('.uiscale__select')
  await expect(select).toBeVisible()
  await expect(select).toHaveValue('100')
  await expect(select.locator('option[value="150"]')).toHaveCount(1) // common increments

  // Double-clicking the control switches to a custom number input (100–200).
  await win.locator('.uiscale').dblclick()
  const input = win.locator('.uiscale__input')
  await expect(input).toBeVisible()
  await expect(input).toHaveAttribute('max', '200')
  await input.press('Escape') // cancel without changing the scale
  await expect(win.locator('.uiscale__select')).toBeVisible()
})

test('sections reorder via the grip handle (not the whole pane) + Reset Layout', async () => {
  // 5 panes, each a stable reorder target...
  await expect(win.locator('[data-rs-pane]')).toHaveCount(5)
  // ...but the PANE itself must NOT be draggable (that hijacks body inputs and
  // the nested key-row drags). Only the grip handle carries draggable.
  await expect(win.locator('[data-rs-pane][draggable="true"]')).toHaveCount(0)
  await expect(win.locator('.section__grip[draggable="true"]')).toHaveCount(5)
  await expect(win.locator('.section__grip').first()).toBeVisible()
  await expect(win.getByRole('button', { name: 'Reset Layout' })).toBeVisible()
})

test('drag-to-resize a section works at a normal window size', async () => {
  const keysPane = win.locator('[data-rs-pane][data-section-id="keys"]')
  // The splitter directly beneath the Keys pane.
  const splitter = keysPane.locator('xpath=following-sibling::*[1]')
  await expect(splitter).toHaveClass(/rs-splitter/)
  await expect(splitter).toHaveCSS('cursor', 'ns-resize')

  const before = (await keysPane.boundingBox())!.height
  const box = (await splitter.boundingBox())!
  // Drag the splitter down 100px. Panes no longer flex-shrink, so the pane
  // should grow by essentially the full drag distance (the column scrolls).
  await win.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await win.mouse.down()
  await win.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 100, { steps: 10 })
  await win.mouse.up()

  const after = (await keysPane.boundingBox())!.height
  // Grew by close to the full 100px (not eaten by the layout)...
  expect(after).toBeGreaterThan(before + 80)
  // ...and the new height was committed (saved per profile) as an inline style.
  await expect(keysPane).toHaveAttribute('style', /height/)

  // Double-click clears the saved height; the pane returns to its natural size.
  await splitter.dblclick()
  await expect(keysPane).not.toHaveAttribute('style', /height/)
  const reset = (await keysPane.boundingBox())!.height
  expect(reset).toBeLessThan(after)
})

test('Text Function has a header Enabled toggle that dims its body', async () => {
  const sec = section('Text Function')
  const toggle = sec.locator('.section__toggle input')
  const body = sec.locator('.section__body')
  await expect(toggle).toBeVisible()

  if (!(await toggle.isChecked())) await toggle.check()
  await expect(body).not.toHaveClass(/section__body--off/)

  await toggle.uncheck()
  await expect(toggle).not.toBeChecked()
  await expect(body).toHaveClass(/section__body--off/)
})

test('the Options (⚙️) button opens a modal with the close-to-tray setting', async () => {
  // Open the dialog from the top bar.
  await win.getByRole('button', { name: 'Options', exact: true }).click()
  const modal = win.locator('.modal')
  await expect(modal).toBeVisible()

  // The close-to-tray checkbox defaults to ON.
  const toggle = modal.locator('.check input[type="checkbox"]')
  await expect(toggle).toBeChecked()

  // Toggling round-trips through the UpdateSettings IPC (the checkbox reflects
  // the value the main process returns), then back on.
  await toggle.uncheck()
  await expect(toggle).not.toBeChecked()
  await toggle.check()
  await expect(toggle).toBeChecked()

  // Closes via the Done button...
  await modal.getByRole('button', { name: 'Done' }).click()
  await expect(win.locator('.modal')).toHaveCount(0)

  // ...and via Escape.
  await win.getByRole('button', { name: 'Options', exact: true }).click()
  await expect(win.locator('.modal')).toBeVisible()
  await win.keyboard.press('Escape')
  await expect(win.locator('.modal')).toHaveCount(0)
})

test('the Sections (👁️) manager hides and restores a section', async () => {
  // Default: all 5 sections render.
  await expect(win.locator('[data-rs-pane]')).toHaveCount(5)
  await expect(section('Macro')).toBeVisible()

  // Open the manager and uncheck "Macro".
  await win.getByRole('button', { name: 'Sections', exact: true }).click()
  const manager = win.locator('.modal')
  await expect(manager).toBeVisible()
  const row = manager.locator('.seclist__row', { hasText: 'Macro' })
  await expect(row.locator('input')).toBeChecked()
  await row.locator('input').uncheck()

  // The section disappears from the main UI; one fewer pane.
  await expect(win.locator('[data-rs-pane]')).toHaveCount(4)
  await expect(section('Macro')).toHaveCount(0)

  // Re-checking via "Show all" brings it back.
  await manager.getByRole('button', { name: 'Show all' }).click()
  await expect(win.locator('[data-rs-pane]')).toHaveCount(5)
  await manager.getByRole('button', { name: 'Done' }).click()
  await expect(win.locator('.modal')).toHaveCount(0)
  await expect(section('Macro')).toBeVisible()
})

test('the top-bar Loop control changes mode (and persists the count field)', async () => {
  const loop = win.locator('.subbar__group').filter({ hasText: 'Loop' })
  const select = loop.locator('select')

  // Default is "Forever" with no count field shown.
  await expect(select).toHaveValue('forever')
  await expect(loop.locator('.subbar__count')).toHaveCount(0)

  // Switching to "Loop X times" reveals the count input.
  await select.selectOption('count')
  await expect(loop.locator('.subbar__count')).toBeVisible()
  await loop.locator('.subbar__count').fill('7')
  await expect(loop.locator('.subbar__count')).toHaveValue('7')

  // "Play Once" hides the count again.
  await select.selectOption('once')
  await expect(select).toHaveValue('once')
  await expect(loop.locator('.subbar__count')).toHaveCount(0)
})

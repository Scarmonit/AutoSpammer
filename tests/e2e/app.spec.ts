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
    'Click Positions',
    'Hold Keys Down',
    'Macro',
    'Profiles',
    'Loop',
    'Hold Modes',
    'Periodic Key'
  ]) {
    await expect(win.getByRole('heading', { name: heading, exact: true })).toBeVisible()
  }
  // The Options section was merged into Keys to Spam — no standalone heading.
  await expect(win.getByRole('heading', { name: 'Options', exact: true })).toHaveCount(0)
  // The Toggle Hotkey section was moved to the top bar — no standalone heading,
  // and the big Start Spam button was removed.
  await expect(win.getByRole('heading', { name: 'Toggle Hotkey', exact: true })).toHaveCount(0)
  await expect(win.locator('.startbtn')).toHaveCount(0)
  await expect(win.getByRole('button', { name: 'Start Spam' })).toHaveCount(0)
})

test('the merged Options controls live inside Keys to Spam', async () => {
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
  // Columns of 5 (left) and 4 (right) sections -> 4 + 3 = 7 splitters (last pane
  // per column has none).
  const splitters = win.locator('.rs-splitter')
  await expect(splitters).toHaveCount(7)
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
  const keysToggle = section('Keys to Spam').locator('.section__toggle input')
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

test('Hold Keys Down: has an Enabled toggle and "+ Add Key" adds a row', async () => {
  const hold = section('Hold Keys Down')
  await expect(hold.locator('.section__toggle input')).toBeVisible()

  const rows = hold.locator('.keyrow')
  const before = await rows.count()
  await hold.getByRole('button', { name: '+ Add Key' }).click()
  await expect(rows).toHaveCount(before + 1)

  // Type into the new row and confirm it sticks.
  const newKey = hold.locator('.keyrow__key').last()
  await newKey.fill('w')
  await expect(newKey).toHaveValue('w')
})

test('Hold Keys Down can add a mouse button as a chip', async () => {
  const hold = section('Hold Keys Down')
  const rows = hold.locator('.keyrow')
  const before = await rows.count()
  await hold.getByRole('button', { name: '+ Left Click' }).click()
  await expect(rows).toHaveCount(before + 1)
  await expect(hold.locator('.keyrow__static', { hasText: 'LMB' })).toBeVisible()
})

test('Periodic Key is a multi-entry list with an Enabled toggle', async () => {
  const periodic = section('Periodic Key')
  await expect(periodic.locator('.section__toggle input')).toBeVisible()

  const rows = periodic.locator('.periodicrow')
  const before = await rows.count()
  await periodic.getByRole('button', { name: '+ Add Periodic Key' }).click()
  await expect(rows).toHaveCount(before + 1)
  // Each row has its own interval field.
  await expect(rows.last().locator('.periodicrow__interval')).toBeVisible()
})

test('every section can be hidden/shown via its header toggle', async () => {
  // 5 sections (left) + 4 sections (right) = 9 collapse buttons.
  await expect(win.locator('.section__collapse')).toHaveCount(9)

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
  // 9 panes, each a stable reorder target...
  await expect(win.locator('[data-rs-pane]')).toHaveCount(9)
  // ...but the PANE itself must NOT be draggable (that hijacks body inputs and
  // the nested key-row drags). Only the grip handle carries draggable.
  await expect(win.locator('[data-rs-pane][draggable="true"]')).toHaveCount(0)
  await expect(win.locator('.section__grip[draggable="true"]')).toHaveCount(9)
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

test('Hold Modes groups the three hold modes, each with its own controls', async () => {
  const hold = section('Hold Modes')
  await expect(hold).toBeVisible()

  // The three former sections are now cards inside one section...
  const cards = hold.locator('.holdmode')
  await expect(cards).toHaveCount(3)
  for (const title of ['Hold-to-Spam Key', 'Focus Hold Key', 'Hold for Right-Click']) {
    await expect(hold.locator('.holdmode__title', { hasText: title })).toBeVisible()
  }
  // ...and each card keeps its own Enabled toggle and Set Key binding.
  await expect(hold.locator('.holdmode .section__toggle input')).toHaveCount(3)
  await expect(hold.getByRole('button', { name: 'Set Key' })).toHaveCount(3)

  // Toggling one card's Enabled switch dims only that card's body.
  const firstCard = cards.first()
  const firstToggle = firstCard.locator('.section__toggle input')
  if (!(await firstToggle.isChecked())) await firstToggle.check()
  await expect(firstCard.locator('.holdmode__body')).not.toHaveClass(/holdmode__body--off/)
  await firstToggle.uncheck()
  await expect(firstCard.locator('.holdmode__body')).toHaveClass(/holdmode__body--off/)

  // The old standalone hold-section headings no longer exist.
  await expect(win.getByRole('heading', { name: 'Hold-to-Spam Key', exact: true })).toHaveCount(0)
  await expect(win.getByRole('heading', { name: 'Focus Hold Key', exact: true })).toHaveCount(0)
  await expect(win.getByRole('heading', { name: 'Hold for Right-Click', exact: true })).toHaveCount(0)
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
  // Default: all 9 sections render.
  await expect(win.locator('[data-rs-pane]')).toHaveCount(9)
  await expect(section('Loop')).toBeVisible()

  // Open the manager and uncheck "Loop".
  await win.getByRole('button', { name: 'Sections', exact: true }).click()
  const manager = win.locator('.modal')
  await expect(manager).toBeVisible()
  const loopRow = manager.locator('.seclist__row', { hasText: 'Loop' })
  await expect(loopRow.locator('input')).toBeChecked()
  await loopRow.locator('input').uncheck()

  // The Loop section disappears from the main UI; one fewer pane.
  await expect(win.locator('[data-rs-pane]')).toHaveCount(8)
  await expect(section('Loop')).toHaveCount(0)

  // Re-checking via "Show all" brings it back.
  await manager.getByRole('button', { name: 'Show all' }).click()
  await expect(win.locator('[data-rs-pane]')).toHaveCount(9)
  await manager.getByRole('button', { name: 'Done' }).click()
  await expect(win.locator('.modal')).toHaveCount(0)
  await expect(section('Loop')).toBeVisible()
})

test('loop mode radios are interactive', async () => {
  const once = section('Loop').locator('label.radio', { hasText: 'Play Once' }).locator('input')
  await once.check()
  await expect(once).toBeChecked()
})

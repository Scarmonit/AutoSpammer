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

/** A card scoped by its exact heading (matching body text must not interfere). */
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

test('renders all seven cards with accent dots and descriptions', async () => {
  for (const heading of [
    'Tap keys',
    'Timers',
    'Hold keys down',
    'Hold triggers',
    'Click positions',
    'Text function',
    'Macro'
  ]) {
    const sec = section(heading)
    await expect(sec).toBeVisible()
    await expect(sec.locator('.section__dot')).toBeVisible()
    // Header switch (the master Enabled toggle for the card).
    await expect(sec.locator('.section__head-actions .section__toggle input')).toBeVisible()
  }
  // Descriptions render by default ("Show hints" on).
  await expect(section('Tap keys').locator('.section__desc')).toHaveText(
    'Rapidly taps all of these, together, the whole time.'
  )
  // The old section names are gone.
  for (const gone of ['Keys to Spam', 'Hold Actions', 'Spam Keys', 'Periodic Actions']) {
    await expect(win.getByRole('heading', { name: gone, exact: true })).toHaveCount(0)
  }
})

test('the WHEN RUNNING summary bar describes the default profile', async () => {
  const bar = win.locator('.summarybar')
  await expect(bar).toBeVisible()
  await expect(bar).toContainText('When running')
  // Default profile: taps space + 1 at the 10 ms default, looping forever.
  await expect(bar).toContainText('tap Space, 1 every 10 ms')
  await expect(bar).toContainText('loops forever')
})

test('Tap keys: seeded keys, adding a key updates the summary live', async () => {
  const keys = section('Tap keys')
  await expect(keys.locator('input.keychip').first()).toHaveValue('space')

  const rows = keys.locator('.keyrow')
  const before = await rows.count()
  await keys.getByRole('button', { name: '+ Add key' }).click()
  await expect(rows).toHaveCount(before + 1)

  const newKey = keys.locator('input.keychip').last()
  await newKey.fill('r')
  await expect(newKey).toHaveValue('r')
  await expect(win.locator('.summarybar')).toContainText('R')
})

test('Tap keys: Space / LMB / RMB quick-add chips toggle and highlight', async () => {
  const keys = section('Tap keys')
  for (const name of ['Space', 'LMB', 'RMB']) {
    const chip = keys.getByRole('button', { name, exact: true })
    await expect(chip).not.toHaveClass(/chipbtn--on/)
    await chip.click()
    await expect(chip).toHaveClass(/chipbtn--on/)
    await chip.click()
    await expect(chip).not.toHaveClass(/chipbtn--on/)
  }
})

test('Tap keys: delay + "One key at a time (sequence)" switch', async () => {
  const keys = section('Tap keys')
  const optionrow = keys.locator('.optionrow')
  await expect(optionrow).toContainText('Delay between taps')
  await expect(optionrow.locator('input[type="number"]')).toHaveValue('10')

  const seq = optionrow.locator('.section__toggle input')
  await expect(seq).not.toBeChecked()
  await seq.check()
  await expect(win.locator('.summarybar')).toContainText('one at a time')
  await seq.uncheck()
})

test('Timers: + Add timer adds a Press/every row', async () => {
  const timers = section('Timers')
  await expect(timers.locator('.section__desc')).toContainText('own schedule')
  const rows = timers.locator('.timerrow')
  const before = await rows.count()

  await timers.getByRole('button', { name: '+ Add timer' }).click()
  await expect(rows).toHaveCount(before + 1)
  await expect(rows.last()).toContainText('Press')
  await expect(rows.last()).toContainText('every')
  await expect(rows.last().locator('.timerrow__interval')).toHaveValue('5')

  // Clean up so later summary assertions stay simple.
  await rows.last().locator('.rowx').click()
  await expect(rows).toHaveCount(before)
})

test('Hold keys down: add-key row, LMB/RMB chips add and remove held buttons', async () => {
  const hold = section('Hold keys down')
  const rows = hold.locator('.keyrow')
  const before = await rows.count()

  await hold.getByRole('button', { name: '+ Add key' }).click()
  await expect(rows).toHaveCount(before + 1)
  const newKey = hold.locator('input.keychip').last()
  await newKey.fill('w')
  await expect(newKey).toHaveValue('w')
  await expect(win.locator('.summarybar')).toContainText('hold W down')

  // LMB quick chip adds a removable chip and highlights; clicking again removes.
  const lmb = hold.getByRole('button', { name: 'LMB', exact: true })
  await lmb.click()
  await expect(lmb).toHaveClass(/chipbtn--on/)
  await expect(hold.locator('.keychip--removable', { hasText: 'LMB' })).toBeVisible()
  await lmb.click()
  await expect(lmb).not.toHaveClass(/chipbtn--on/)
  await expect(hold.locator('.keychip--removable', { hasText: 'LMB' })).toHaveCount(0)

  // Remove the added key row again.
  await rows.last().locator('.rowx').click()
  await expect(rows).toHaveCount(before)
})

test('Hold triggers: three renamed rows, each with its own switch and key/delay line', async () => {
  const trig = section('Hold triggers')
  await expect(trig.locator('.trigrow')).toHaveCount(3)
  for (const title of [
    'Hold to spam everything',
    'Hold to rapid-fire one key',
    'Hold to rapid right-click'
  ]) {
    await expect(trig.locator('.trigrow__title', { hasText: title })).toBeVisible()
  }
  // A disabled trigger greys out its inline key/delay line.
  const first = trig.locator('.trigrow').first()
  const firstSwitch = first.locator('.section__toggle input')
  await expect(firstSwitch).not.toBeChecked() // off by default
  await expect(first).toHaveClass(/trigrow--off/)
  await firstSwitch.check()
  await expect(first).not.toHaveClass(/trigrow--off/)
  await firstSwitch.uncheck()
})

test('Hold triggers master switch disables the card but keeps inner state', async () => {
  const trig = section('Hold triggers')
  const master = trig.locator('.section__head-actions .section__toggle input')
  const body = trig.locator('.section__body')
  const inner = trig.locator('.trigrow').first().locator('.section__toggle input')

  if (!(await master.isChecked())) await master.check()
  await inner.check()
  await expect(body).not.toHaveClass(/section__body--off/)

  // Master off: body dims and becomes non-interactive...
  await master.uncheck()
  await expect(body).toHaveClass(/section__body--off/)
  await expect(body).toHaveCSS('pointer-events', 'none')
  // ...while the inner switch keeps its checked state (not reset).
  await expect(inner).toBeChecked()

  // Master back on: interactive again with the inner state intact.
  await master.check()
  await expect(body).not.toHaveClass(/section__body--off/)
  await expect(inner).toBeChecked()
  await inner.uncheck() // restore the default
})

test('Click positions: empty state and renamed action buttons', async () => {
  const positions = section('Click positions')
  await expect(positions.locator('.section__desc')).toContainText('saved screen spots')
  await expect(positions.getByText('No positions saved yet.')).toBeVisible()
  await expect(positions.getByRole('button', { name: '+ Add position' })).toBeVisible()
  await expect(positions.getByRole('button', { name: '● Record clicks' })).toBeVisible()
})

test('Macro card: empty state, record + hotkey + play controls', async () => {
  const macro = section('Macro')
  await expect(macro.locator('.section__desc')).toContainText('replay it on loop')
  await expect(macro.getByText('No macro recorded yet.')).toBeVisible()
  await expect(macro.getByRole('button', { name: '● Record' })).toBeVisible()
  await expect(macro.getByRole('button', { name: /Record hotkey/ })).toBeVisible()
  await expect(macro.getByRole('button', { name: '▶ Play once' })).toBeVisible()
})

test('enabling Macro disables Tap keys and Click positions (mutually exclusive)', async () => {
  const macroToggle = section('Macro').locator('.section__head-actions .section__toggle input')
  const keysToggle = section('Tap keys').locator('.section__head-actions .section__toggle input')
  const posToggle = section('Click positions').locator(
    '.section__head-actions .section__toggle input'
  )

  if (!(await keysToggle.isChecked())) await keysToggle.check()
  if (!(await posToggle.isChecked())) await posToggle.check()

  await macroToggle.check()
  await expect(keysToggle).not.toBeChecked()
  await expect(posToggle).not.toBeChecked()

  // Re-enabling a spam source turns Macro back off.
  await keysToggle.check()
  await expect(macroToggle).not.toBeChecked()
  await posToggle.check()
})

test('the Profile toolbar is a dropdown with New / Save / Delete (no Rename)', async () => {
  const profile = win.locator('.subbar__group').filter({ hasText: 'Profile' })
  await expect(profile.locator('select')).toBeVisible()
  for (const name of ['New', 'Save', 'Delete']) {
    await expect(profile.getByRole('button', { name, exact: true })).toBeVisible()
  }
  await expect(profile.getByRole('button', { name: 'Rename', exact: true })).toHaveCount(0)
  await expect(profile.locator('select option')).toContainText(['Default'])
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

test('renders draggable splitters between sections', async () => {
  // Columns of 3 (left) and 4 (right) cards -> 2 + 3 = 5 splitters (last pane
  // per column has none).
  const splitters = win.locator('.rs-splitter')
  await expect(splitters).toHaveCount(5)
  await expect(splitters.first()).toHaveCSS('cursor', 'ns-resize')
})

test('sections reorder via the grip handle (not the whole pane) + Reset Layout', async () => {
  // 7 panes, each a stable reorder target...
  await expect(win.locator('[data-rs-pane]')).toHaveCount(7)
  // ...but the PANE itself must NOT be draggable (that hijacks body inputs and
  // the nested key-row drags). Only the grip handle carries draggable.
  await expect(win.locator('[data-rs-pane][draggable="true"]')).toHaveCount(0)
  await expect(win.locator('.section__grip[draggable="true"]')).toHaveCount(7)
  await expect(win.locator('.section__grip').first()).toBeVisible()
  await expect(win.getByRole('button', { name: 'Reset Layout' })).toBeVisible()
})

test('drag-to-resize a section works at a normal window size', async () => {
  const keysPane = win.locator('[data-rs-pane][data-section-id="keys"]')
  // The splitter directly beneath the Tap keys pane.
  const splitter = keysPane.locator('xpath=following-sibling::*[1]')
  await expect(splitter).toHaveClass(/rs-splitter/)
  await expect(splitter).toHaveCSS('cursor', 'ns-resize')

  // Hover first: it scrolls the splitter into view AND waits for its position
  // to be stable, so the drag can't race layout still settling from the
  // previous test.
  await splitter.hover()
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

test('every card can be collapsed via its header chevron', async () => {
  // One collapse button per card.
  await expect(win.locator('.section__collapse')).toHaveCount(7)

  const keys = section('Tap keys')
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

test('Text function has a header switch that dims its body', async () => {
  const sec = section('Text function')
  const toggle = sec.locator('.section__head-actions .section__toggle input')
  const body = sec.locator('.section__body')
  await expect(toggle).toBeVisible()

  if (!(await toggle.isChecked())) await toggle.check()
  await expect(body).not.toHaveClass(/section__body--off/)

  await toggle.uncheck()
  await expect(toggle).not.toBeChecked()
  await expect(body).toHaveClass(/section__body--off/)
})

test('Options modal: Display switches control hints + summary bar, tray setting round-trips', async () => {
  await win.getByRole('button', { name: 'Options', exact: true }).click()
  const modal = win.locator('.modal')
  await expect(modal).toBeVisible()
  await expect(modal).toContainText('Display')

  const switches = modal.locator('.modal__switchrow .section__toggle input')
  await expect(switches).toHaveCount(2)
  const hints = switches.nth(0)
  const summary = switches.nth(1)
  await expect(hints).toBeChecked() // both default to on
  await expect(summary).toBeChecked()

  // "Show hints" off hides the card descriptions; back on restores them.
  await hints.uncheck()
  await expect(win.locator('.section__desc').first()).toBeHidden()
  await hints.check()
  await expect(win.locator('.section__desc').first()).toBeVisible()

  // "Show summary bar" off removes the WHEN RUNNING bar; back on restores it.
  await summary.uncheck()
  await expect(win.locator('.summarybar')).toHaveCount(0)
  await summary.check()
  await expect(win.locator('.summarybar')).toBeVisible()

  // The close-to-tray checkbox defaults to ON and round-trips.
  const tray = modal.locator('.check input[type="checkbox"]')
  await expect(tray).toBeChecked()
  await tray.uncheck()
  await expect(tray).not.toBeChecked()
  await tray.check()
  await expect(tray).toBeChecked()

  // Closes via the Done button and via Escape.
  await modal.getByRole('button', { name: 'Done' }).click()
  await expect(win.locator('.modal')).toHaveCount(0)
  await win.getByRole('button', { name: 'Options', exact: true }).click()
  await expect(win.locator('.modal')).toBeVisible()
  await win.keyboard.press('Escape')
  await expect(win.locator('.modal')).toHaveCount(0)
})

test('the Sections (👁️) manager hides and restores a card', async () => {
  // Default: all 7 cards render.
  await expect(win.locator('[data-rs-pane]')).toHaveCount(7)
  await expect(section('Macro')).toBeVisible()

  // Open the manager and uncheck "Macro".
  await win.getByRole('button', { name: 'Sections', exact: true }).click()
  const manager = win.locator('.modal')
  await expect(manager).toBeVisible()
  await expect(manager.locator('.seclist__row')).toHaveCount(7)
  const row = manager.locator('.seclist__row', { hasText: 'Macro' })
  await expect(row.locator('input')).toBeChecked()
  await row.locator('input').uncheck()

  // The card disappears from the main UI; one fewer pane.
  await expect(win.locator('[data-rs-pane]')).toHaveCount(6)
  await expect(section('Macro')).toHaveCount(0)

  // Re-checking via "Show all" brings it back.
  await manager.getByRole('button', { name: 'Show all' }).click()
  await expect(win.locator('[data-rs-pane]')).toHaveCount(7)
  await manager.getByRole('button', { name: 'Done' }).click()
  await expect(win.locator('.modal')).toHaveCount(0)
  await expect(section('Macro')).toBeVisible()
})

test('the top-bar Loop control changes mode (and the summary follows)', async () => {
  const loop = win.locator('.subbar__group').filter({ hasText: 'Loop' })
  const select = loop.locator('select')

  // Default is "Forever" with no count field shown.
  await expect(select).toHaveValue('forever')
  await expect(loop.locator('.subbar__count')).toHaveCount(0)

  // Switching to "Loop X times" reveals the count input and updates the summary.
  await select.selectOption('count')
  await expect(loop.locator('.subbar__count')).toBeVisible()
  await loop.locator('.subbar__count').fill('7')
  await expect(loop.locator('.subbar__count')).toHaveValue('7')
  await expect(win.locator('.summarybar')).toContainText('loops 7 times')

  // "Play Once" hides the count again.
  await select.selectOption('once')
  await expect(select).toHaveValue('once')
  await expect(loop.locator('.subbar__count')).toHaveCount(0)
  await expect(win.locator('.summarybar')).toContainText('plays once')
})

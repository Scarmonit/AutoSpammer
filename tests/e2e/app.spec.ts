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
    'Options',
    'Click Positions',
    'Hold Keys Down',
    'Macro',
    'Profiles',
    'Loop',
    'Periodic Key'
  ]) {
    await expect(win.getByRole('heading', { name: heading, exact: true })).toBeVisible()
  }
  await expect(win.getByRole('button', { name: 'Start Spam' })).toBeVisible()
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
  // Two columns of 6 and 7 sections -> 5 + 6 = 11 splitters (last pane per column
  // has none).
  const splitters = win.locator('.rs-splitter')
  await expect(splitters).toHaveCount(11)
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

test('the main Start button reflects Macro mode', async () => {
  const startBtn = win.locator('.startbtn')
  await expect(startBtn).toHaveText('Start Spam')

  await section('Macro').locator('.section__toggle input').check()
  await expect(startBtn).toHaveText('Start Macro')

  // Restore: re-enabling a spam source turns Macro off again.
  await section('Keys to Spam').locator('.section__toggle input').check()
  await expect(startBtn).toHaveText('Start Spam')
})

test('only one Set Key listener is active at a time', async () => {
  const hk = section('Toggle Hotkey')
  await hk.getByRole('button', { name: 'Change Key' }).click()
  await expect(hk.locator('.btn--listening')).toHaveCount(1)

  // Starting the Emergency capture must cancel the first one (not bind to both).
  await hk.getByRole('button', { name: 'Change Emergency Key' }).click()
  await expect(hk.locator('.btn--listening')).toHaveCount(1)

  // Clicking the active button again cancels capture.
  await hk.locator('.btn--listening').click()
  await expect(hk.locator('.btn--listening')).toHaveCount(0)
})

test('the Escape key can be bound to a hotkey', async () => {
  const hk = section('Toggle Hotkey')
  const caps = hk.locator('.keycap') // [0] = toggle current, [1] = emergency current

  // Move Emergency off Escape (to F1) so Escape is free to assign.
  await hk.getByRole('button', { name: 'Change Emergency Key' }).click()
  await win.keyboard.press('F1')
  await expect(caps.nth(1)).toHaveText('F1')

  // Escape now binds normally instead of cancelling the capture.
  await hk.getByRole('button', { name: 'Change Key' }).click()
  await win.keyboard.press('Escape')
  await expect(caps.nth(0)).toHaveText('Escape')
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

test('every section can be hidden/shown via its header toggle', async () => {
  // 6 sections (left) + 7 sections (right) = 13 collapse buttons.
  await expect(win.locator('.section__collapse')).toHaveCount(13)

  const keys = section('Keys to Spam')
  await expect(keys.locator('.section__body')).toBeVisible()

  await keys.locator('.section__collapse').click()
  await expect(keys).toHaveClass(/section--collapsed/)
  await expect(keys.locator('.section__body')).toBeHidden()

  await keys.locator('.section__collapse').click()
  await expect(keys.locator('.section__body')).toBeVisible()
})

test('loop mode radios are interactive', async () => {
  const once = section('Loop').locator('label.radio', { hasText: 'Play Once' }).locator('input')
  await once.check()
  await expect(once).toBeChecked()
})

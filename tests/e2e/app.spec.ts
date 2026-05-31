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

/** A panel scoped by its heading (class names repeat across panels). */
const section = (heading: string): Locator => win.locator('.section', { hasText: heading })

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

test('loop mode radios are interactive', async () => {
  const once = section('Loop').locator('label.radio', { hasText: 'Play Once' }).locator('input')
  await once.check()
  await expect(once).toBeChecked()
})

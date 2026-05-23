// Launches the built app and saves a screenshot for the README.
const { _electron: electron } = require('@playwright/test')
const { mkdtempSync } = require('fs')
const { tmpdir } = require('os')
const { join } = require('path')

;(async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'autospammer-shot-'))
  const app = await electron.launch({ args: ['.', `--user-data-dir=${userDataDir}`] })
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')
  await win.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  await new Promise((r) => setTimeout(r, 1500))
  await win.screenshot({ path: 'docs/screenshot.png' })
  console.log('saved docs/screenshot.png; first key value =', await win.locator('.keyrow__key').first().inputValue())
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
})()

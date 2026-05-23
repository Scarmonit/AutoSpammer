import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// Unit tests run in plain Node and cover the pure logic (engine, keymap,
// defaults). The Electron main/renderer wiring is covered by the Playwright
// end-to-end tests in tests/e2e instead.
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    globals: false
  }
})

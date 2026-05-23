/// <reference types="vite/client" />
import type { AutoSpammerApi } from '../../preload'

declare global {
  interface Window {
    api: AutoSpammerApi
  }
}

export {}

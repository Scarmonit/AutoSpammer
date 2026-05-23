import { Tray, Menu, nativeImage, type BrowserWindow } from 'electron'
import { TRAY_ICON_DATA_URL } from './trayicon'

interface TrayDeps {
  getWindow: () => BrowserWindow | null
  isSpamming: () => boolean
  onToggleSpam: () => void
  onPanic: () => void
  onQuit: () => void
}

export interface TrayHandle {
  tray: Tray
  update: () => void
}

/**
 * System-tray icon + menu so the app stays usable while its window is hidden
 * (e.g. tucked away during a game). Mirrors Electron's Tray/Notifications
 * examples (https://www.electronjs.org/docs/latest/tutorial/tray).
 */
export function createTray(deps: TrayDeps): TrayHandle {
  const tray = new Tray(nativeImage.createFromDataURL(TRAY_ICON_DATA_URL))

  const showWindow = (): void => {
    const w = deps.getWindow()
    if (!w) return
    if (w.isMinimized()) w.restore()
    w.show()
    w.focus()
  }

  const update = (): void => {
    const running = deps.isSpamming()
    tray.setToolTip(running ? 'Auto Spammer — running' : 'Auto Spammer — idle')
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Show Auto Spammer', click: showWindow },
        { type: 'separator' },
        { label: running ? 'Stop Spam' : 'Start Spam', click: () => deps.onToggleSpam() },
        { label: 'Panic Stop (everything)', click: () => deps.onPanic() },
        { type: 'separator' },
        { label: 'Quit Auto Spammer', click: () => deps.onQuit() }
      ])
    )
  }

  tray.on('click', showWindow)
  tray.on('double-click', showWindow)
  update()

  return { tray, update }
}

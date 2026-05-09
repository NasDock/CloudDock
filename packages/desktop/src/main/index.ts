import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, globalShortcut } from 'electron'
import { join } from 'path'
import { CloudDockDesktopClient } from './network/cloud-dock-client'
import { configStore, desktopDeviceId, desktopDeviceName, desktopDevicePlatform } from './stores/desktop-config'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let client: CloudDockDesktopClient | null = null
let isQuitting = false

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: 'CloudDock',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

const createTray = (): void => {
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('CloudDock')
  updateTrayMenu()
}

const updateTrayMenu = (): void => {
  if (!tray) return
  const status = client?.getVPNStatus() ?? 'idle'
  const statusLabel = {
    idle: '未连接',
    connecting: '连接中...',
    connected: '已连接',
    failed: '连接失败',
  }[status]

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示 CloudDock',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      },
    },
    { type: 'separator' },
    {
      label: `VPN: ${statusLabel}`,
      enabled: false,
    },
    {
      label: status === 'connected' ? '断开组网' : '开启组网',
      click: () => toggleVPN(),
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])
  tray.setContextMenu(contextMenu)
}

const toggleVPN = async (): Promise<void> => {
  if (!client) return
  const status = client.getVPNStatus()
  if (status === 'connected' || status === 'connecting') {
    await client.stopVPN()
  } else {
    await client.startVPN()
  }
}

const broadcastVPNStatus = (): void => {
  const status = client?.getVPNStatus() ?? 'idle'
  mainWindow?.webContents.send('vpn:status', status)
  updateTrayMenu()
}

const broadcastVPNStats = (): void => {
  const stats = client?.getVPNStats() ?? { bytesIn: 0, bytesOut: 0 }
  mainWindow?.webContents.send('vpn:stats', stats)
}

app.whenReady().then(() => {
  createWindow()
  createTray()

  client = new CloudDockDesktopClient()
  client.onVPNStatusChange = () => broadcastVPNStatus()
  client.onVPNStatsUpdate = () => broadcastVPNStats()

  ipcMain.on('vpn:toggle', () => toggleVPN())

  ipcMain.on('auth:setToken', (_event, token: string) => {
    configStore.set('accessToken', token)
  })

  ipcMain.on('auth:clearToken', () => {
    configStore.set('accessToken', '')
    configStore.set('refreshToken', '')
    client?.stopVPN().catch(() => {})
  })

  ipcMain.handle('device:getId', () => desktopDeviceId)
  ipcMain.handle('device:getName', () => desktopDeviceName)
  ipcMain.handle('device:getPlatform', () => desktopDevicePlatform)

  globalShortcut.register('CommandOrControl+Shift+C', () => {
    toggleVPN()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow?.show()
    }
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  client?.dispose()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

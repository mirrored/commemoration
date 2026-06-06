import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import {
  fetchCurrentUser,
  getStoredSession,
  login,
  logout,
  AuthError
} from './auth'
import { getGraveHuman, listGraveHumans } from './grave-human'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('auth:login', async (_event, username: string, password: string) => {
    try {
      const session = await login(username, password)
      return { ok: true as const, session }
    } catch (error) {
      const message = error instanceof AuthError ? error.message : 'Login failed'
      return { ok: false as const, error: message }
    }
  })

  ipcMain.handle('auth:logout', async () => {
    logout()
    return { ok: true as const }
  })

  ipcMain.handle('auth:getSession', async () => {
    const session = getStoredSession()
    if (!session) {
      return { ok: true as const, session: null }
    }

    try {
      const user = await fetchCurrentUser()
      return {
        ok: true as const,
        session: { ...session, user }
      }
    } catch {
      logout()
      return { ok: true as const, session: null }
    }
  })

  ipcMain.handle('grave-human:list', async () => {
    try {
      const data = await listGraveHumans()
      return { ok: true as const, data }
    } catch (error) {
      const message = error instanceof AuthError ? error.message : 'Failed to load records'
      return { ok: false as const, error: message }
    }
  })

  ipcMain.handle('grave-human:get', async (_event, id: number) => {
    try {
      const data = await getGraveHuman(id)
      return { ok: true as const, data }
    } catch (error) {
      const message = error instanceof AuthError ? error.message : 'Failed to load record'
      return { ok: false as const, error: message }
    }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.commemorate')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

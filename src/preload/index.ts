import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

import type { GraveHumanDetail, GraveHumanSummary } from '../shared/grave-human'
import type { Session } from '../shared/session'

export type { Session, SessionUser } from '../shared/session'
export type { GraveHumanDetail, GraveHumanSummary } from '../shared/grave-human'

export interface AuthAPI {
  login: (
    username: string,
    password: string
  ) => Promise<{ ok: true; session: Session } | { ok: false; error: string }>
  logout: () => Promise<{ ok: true }>
  getSession: () => Promise<{ ok: true; session: Session | null }>
}

export interface GraveHumanAPI {
  list: () => Promise<{ ok: true; data: GraveHumanSummary[] } | { ok: false; error: string }>
  get: (id: number) => Promise<{ ok: true; data: GraveHumanDetail } | { ok: false; error: string }>
}

const api = {
  auth: {
    login: (username: string, password: string) =>
      ipcRenderer.invoke('auth:login', username, password),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getSession: () => ipcRenderer.invoke('auth:getSession')
  },
  graveHuman: {
    list: () => ipcRenderer.invoke('grave-human:list'),
    get: (id: number) => ipcRenderer.invoke('grave-human:get', id)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI
  // @ts-expect-error (define in dts)
  window.api = api
}

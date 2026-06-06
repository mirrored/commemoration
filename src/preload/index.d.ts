import { ElectronAPI } from '@electron-toolkit/preload'
import type { AuthAPI, GraveHumanAPI } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      auth: AuthAPI
      graveHuman: GraveHumanAPI
    }
  }
}

export {}

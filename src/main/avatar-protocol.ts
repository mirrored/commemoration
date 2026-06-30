import { net, protocol } from 'electron'
import { existsSync } from 'fs'
import { pathToFileURL } from 'url'
import { parseLocalAvatarProtocolPath } from '../shared/local-avatar'
import { resolveAvatarFilePath } from './avatars'

export function registerAvatarProtocolSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'commemorate',
      privileges: {
        secure: true,
        standard: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true
      }
    }
  ])
}

export function registerAvatarProtocolHandler(): void {
  protocol.handle('commemorate', async (request) => {
    const relativePath = parseLocalAvatarProtocolPath(request.url)
    if (!relativePath) {
      return new Response('Not found', { status: 404 })
    }

    const filePath = resolveAvatarFilePath(relativePath)
    if (!filePath || !existsSync(filePath)) {
      return new Response('Not found', { status: 404 })
    }

    return net.fetch(pathToFileURL(filePath).toString())
  })
}

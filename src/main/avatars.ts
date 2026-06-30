import { app } from 'electron'
import { existsSync } from 'fs'
import { join, normalize, resolve } from 'path'

let avatarsRoot: string | null = null

function candidateAvatarRoots(): string[] {
  const fromEnv = process.env.COMMEMORATE_AVATARS_DIR?.trim()
  const roots = [
    fromEnv || null,
    join(process.resourcesPath, 'avatars'),
    join(app.getAppPath(), '../server/data/avatars'),
    join(__dirname, '../../../server/data/avatars'),
    join(process.cwd(), 'server/data/avatars'),
    join(process.cwd(), '../server/data/avatars')
  ]
  return roots.filter((value): value is string => Boolean(value))
}

export function getAvatarsRoot(): string {
  if (avatarsRoot) return avatarsRoot

  for (const candidate of candidateAvatarRoots()) {
    const resolved = resolve(candidate)
    if (existsSync(resolved)) {
      avatarsRoot = resolved
      return resolved
    }
  }

  avatarsRoot = resolve(join(app.getAppPath(), '../server/data/avatars'))
  return avatarsRoot
}

export function resolveAvatarFilePath(relativePath: string): string | null {
  const normalized = normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '')
  if (!normalized || normalized.startsWith('..') || normalized.includes('\\')) {
    return null
  }
  return join(getAvatarsRoot(), normalized)
}

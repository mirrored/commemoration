/** DB / JSON 中本地头像前缀，例如 local:avatars/1994/kongfansen.webp */
export const LOCAL_AVATAR_PREFIX = 'local:avatars/'

/** commemorate://avatar/1994/kongfansen.webp */
export const LOCAL_AVATAR_PROTOCOL = 'commemorate://avatar/'

/** 从 avatar 字段解析出相对于 server/data/avatars 的路径 */
export function parseLocalAvatarRelativePath(avatar: string): string | null {
  const value = avatar.trim()
  if (!value.startsWith(LOCAL_AVATAR_PREFIX)) return null
  const relative = value.slice(LOCAL_AVATAR_PREFIX.length).replace(/^\/+/, '')
  if (!relative || relative.includes('..') || relative.includes('\\')) return null
  return relative
}

export function isLocalAvatarRef(avatar: string | null | undefined): boolean {
  return avatar != null && parseLocalAvatarRelativePath(avatar) != null
}

export function localAvatarProtocolUrl(relativePath: string): string {
  const encoded = relativePath.split('/').map(encodeURIComponent).join('/')
  return `${LOCAL_AVATAR_PROTOCOL}${encoded}`
}

export function parseLocalAvatarProtocolPath(url: string): string | null {
  if (!url.startsWith(LOCAL_AVATAR_PROTOCOL)) return null
  const encoded = url.slice(LOCAL_AVATAR_PROTOCOL.length).replace(/^\/+/, '')
  if (!encoded) return null
  try {
    const relative = encoded
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .join('/')
    if (!relative || relative.includes('..') || relative.includes('\\')) return null
    return relative
  } catch {
    return null
  }
}

import { genderBranchColors } from './colors'

/**
 * 解析头像地址。
 * 支持：
 * - https:// / http:// 直链图片（JPEG/JPG/PNG/GIF/WebP/SVG 等，由浏览器按 Content-Type 解码）
 * - data:image/...;base64,... 等 Data URL
 * - Wikimedia Commons：…/wiki/Special:FilePath/文件名（会 302 到 upload.wikimedia.org）
 * 不支持：本地相对路径、file://（需自行转为 http(s) 或 data URL）
 */
export function resolveAvatarSrc(avatar: string | null | undefined): string | null {
  if (!avatar?.trim()) return null
  const value = avatar.trim()
  if (value.startsWith('data:')) return value
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value
  }
  return null
}

export function hasExternalAvatar(avatar: string | null | undefined): boolean {
  return resolveAvatarSrc(avatar) != null
}

/** 无头像时用姓名首字 + 性别色生成 SVG data URL（离线可用，无需第三方图床） */
export function createInitialsAvatarDataUrl(name: string, gender: string, size = 72): string {
  const initial = (name.trim().slice(0, 1) || '?').replace(/[<>&"']/g, '')
  const { fill } = genderBranchColors(gender)
  const fontSize = Math.round(size * 0.45)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${fill}"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-size="${fontSize}" font-family="Inter, system-ui, sans-serif" font-weight="600">${initial}</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function avatarSrcForPerson(
  name: string,
  gender: string,
  avatar: string | null | undefined
): string {
  return resolveAvatarSrc(avatar) ?? createInitialsAvatarDataUrl(name, gender)
}

/** 时间轴节点：仅用本地 SVG，避免 Electron 拉取外链头像时反复 SSL 报错 */
export function avatarSrcForTimeline(
  name: string,
  gender: string,
  _avatar: string | null | undefined,
  size = 72
): string {
  return createInitialsAvatarDataUrl(name, gender, size)
}

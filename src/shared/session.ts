export interface SessionUser {
  id: number
  username: string
  display_name: string
}

export interface Session {
  token: string
  expiresAt: string
  user: SessionUser
}

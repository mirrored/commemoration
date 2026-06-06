import { API_BASE_URL } from './config'
import { getSession, setSession, type Session, type SessionUser } from './session'

interface LoginResponse {
  token: string
  expires_at: string
  user: SessionUser
}

interface ApiError {
  error: string
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiError
    return body.error || `Request failed (${response.status})`
  } catch {
    return `Request failed (${response.status})`
  }
}

export async function login(username: string, password: string): Promise<Session> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })

  if (!response.ok) {
    throw new AuthError(await parseError(response))
  }

  const body = (await response.json()) as LoginResponse
  const session: Session = {
    token: body.token,
    expiresAt: body.expires_at,
    user: body.user
  }

  setSession(session)
  return session
}

export async function fetchCurrentUser(): Promise<SessionUser> {
  const session = getSession()
  if (!session) {
    throw new AuthError('Not logged in')
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${session.token}` }
  })

  if (!response.ok) {
    if (response.status === 401) {
      setSession(null)
    }
    throw new AuthError(await parseError(response))
  }

  return (await response.json()) as SessionUser
}

export function logout(): void {
  setSession(null)
}

export function getStoredSession(): Session | null {
  return getSession()
}

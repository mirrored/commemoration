import { API_BASE_URL } from './config'
import { getSession, setSession } from './session'
import { AuthError } from './auth'

interface ApiError {
  error: string
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiError
    return body.error || `Request failed (${response.status})`
  } catch {
    return `Request failed (${response.status})`
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const session = getSession()
  if (!session) {
    throw new AuthError('Not logged in')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${session.token}` }
  })

  if (!response.ok) {
    if (response.status === 401) {
      setSession(null)
    }
    throw new AuthError(await parseError(response))
  }

  return (await response.json()) as T
}

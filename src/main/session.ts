import type { Session } from '../shared/session'

export type { Session, SessionUser } from '../shared/session'

let currentSession: Session | null = null

export function getSession(): Session | null {
  return currentSession
}

export function setSession(session: Session | null): void {
  currentSession = session
}

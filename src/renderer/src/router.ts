export type AppRoute =
  | { name: 'login' }
  | { name: 'timeline' }
  | { name: 'person'; id: number }

export function parseRoute(hash: string): AppRoute {
  const path = hash.replace(/^#/, '') || '/timeline'

  if (path === '/login' || path === '/') {
    return { name: 'login' }
  }

  if (path === '/timeline') {
    return { name: 'timeline' }
  }

  const personMatch = path.match(/^\/person\/(\d+)$/)
  if (personMatch) {
    return { name: 'person', id: Number(personMatch[1]) }
  }

  return { name: 'timeline' }
}

export function routeToHash(route: AppRoute): string {
  switch (route.name) {
    case 'login':
      return '#/login'
    case 'timeline':
      return '#/timeline'
    case 'person':
      return `#/person/${route.id}`
  }
}

export function navigate(route: AppRoute): void {
  const next = routeToHash(route)
  if (window.location.hash !== next) {
    window.location.hash = next
  }
}

export function onRouteChange(listener: (route: AppRoute) => void): () => void {
  const handler = (): void => listener(parseRoute(window.location.hash))
  window.addEventListener('hashchange', handler)
  return () => window.removeEventListener('hashchange', handler)
}

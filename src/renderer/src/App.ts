import type { Session } from '../../shared/session'
import { mountLoginView } from './views/LoginView'
import { mountPersonDetailView } from './views/PersonDetailView'
import { mountTimelineView, type TimelineViewHandle } from './views/TimelineView'
import { navigate, onRouteChange, parseRoute, type AppRoute } from './router'

let timelineHandle: TimelineViewHandle | null = null

function destroyTimeline(): void {
  if (timelineHandle) {
    timelineHandle.destroy()
    timelineHandle = null
  }
}

async function renderRoute(route: AppRoute, session: Session | null): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  destroyTimeline()

  if (!session) {
    if (route.name !== 'login') {
      navigate({ name: 'login' })
    }
    app.className = 'app-shell app-shell--centered'
    mountLoginView(app, () => {
      void window.api.auth.getSession().then((result) => {
        if (result.session) {
          navigate({ name: 'timeline' })
        }
      })
    })
    return
  }

  if (route.name === 'login') {
    navigate({ name: 'timeline' })
    return
  }

  if (route.name === 'person') {
    app.className = 'app-shell app-shell--scroll'
    await mountPersonDetailView(app, route.id)
    return
  }

  app.className = 'app-shell app-shell--timeline'
  timelineHandle = await mountTimelineView(app, () => {
    navigate({ name: 'login' })
  })
}

export async function createApp(): Promise<void> {
  const sessionResult = await window.api.auth.getSession()
  const session = sessionResult.session

  if (session && (window.location.hash === '' || window.location.hash === '#/login')) {
    navigate({ name: 'timeline' })
  }

  if (!session) {
    navigate({ name: 'login' })
  }

  const run = (): void => {
    void renderRoute(parseRoute(window.location.hash), session)
  }

  onRouteChange(() => {
    void window.api.auth.getSession().then((result) => {
      void renderRoute(parseRoute(window.location.hash), result.session)
    })
  })

  run()
}

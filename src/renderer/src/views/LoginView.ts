import type { Session } from '../../../shared/session'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function renderLoginView(): string {
  return `
    <div class="auth-card">
      <div class="brand">
        <h1>Commemorate</h1>
        <p class="subtitle">登录以继续</p>
      </div>
      <form id="login-form" class="login-form">
        <label class="field">
          <span>用户名</span>
          <input id="username" name="username" type="text" autocomplete="username" required autofocus />
        </label>
        <label class="field">
          <span>密码</span>
          <input id="password" name="password" type="password" autocomplete="current-password" required />
        </label>
        <p id="error-message" class="error-message" hidden></p>
        <button id="login-button" type="submit">登录</button>
      </form>
      <p class="hint">默认账号：admin / Canoe@2026</p>
    </div>
  `
}

export function mountLoginView(
  root: HTMLElement,
  onSuccess: (session: Session) => void
): void {
  root.innerHTML = renderLoginView()

  const form = root.querySelector<HTMLFormElement>('#login-form')
  const button = root.querySelector<HTMLButtonElement>('#login-button')
  const errorEl = root.querySelector<HTMLParagraphElement>('#error-message')
  const usernameInput = root.querySelector<HTMLInputElement>('#username')
  if (!form || !button || !errorEl || !usernameInput) return

  requestAnimationFrame(() => {
    usernameInput.focus()
  })

  const showError = (message: string): void => {
    errorEl.textContent = message
    errorEl.hidden = false
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    errorEl.hidden = true

    const username = form.username.value.trim()
    const password = form.password.value
    if (!username || !password) {
      showError('请输入用户名和密码')
      return
    }

    button.disabled = true
    button.textContent = '登录中...'

    const result = await window.api.auth.login(username, password)
    button.disabled = false
    button.textContent = '登录'

    if (!result.ok) {
      showError(escapeHtml(result.error))
      return
    }

    onSuccess(result.session)
  })
}

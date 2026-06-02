export function createApp(): void {
  const app = document.querySelector<HTMLDivElement>('#app')!

  app.innerHTML = `
    <div class="container">
      <h1>Commemorate</h1>
      <p>Electron + Vite + TypeScript</p>
    </div>
  `
}

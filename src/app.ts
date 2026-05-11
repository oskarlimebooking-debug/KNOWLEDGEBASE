export function mountApp(root: HTMLElement | null): void {
  if (!root) {
    throw new Error('mountApp: #app root element not found');
  }
  root.innerHTML = `
    <main class="shell">
      <h1>Headway</h1>
      <p class="tagline">Personal knowledge platform — READ / RESEARCH / WRITE.</p>
      <p class="status">Phase A scaffold — hello, world.</p>
    </main>
  `;
}

// In-memory secret store for credentials (AI API keys, OAuth tokens, etc.).
//
// Storage model — module-level Map, no persistence:
//   * Held only in a closure inside this module. Other JS in the origin
//     cannot reach it via `sessionStorage`/`localStorage`/`indexedDB`/
//     `document.cookie`. The single avenue is `import { getSecret } from
//     './secrets'`, which only callers compiled into the bundle have.
//   * Cleared on `pagehide` so a closed tab leaves nothing behind.
//   * Decision recorded in phase-A audit P1-#2 + P1-#1: pick in-memory
//     over crypto.subtle-wrapped IDB or a backend proxy. If a future
//     requirement demands cross-session persistence, replace this body
//     with a WebCrypto AES-GCM wrapper backed by IDB — the public API
//     does not have to change.
//
// Convention: `setSetting`/`getSetting` (in db.ts) must NEVER receive a
// credential. Route every credential through this module.

const store = new Map<string, string>();

function assertName(name: string): void {
  if (!name) throw new Error('secret name must be a non-empty string');
}

export function setSecret(name: string, value: string): void {
  assertName(name);
  store.set(name, value);
}

export function getSecret(name: string): string | undefined {
  assertName(name);
  return store.get(name);
}

export function clearSecret(name: string): void {
  assertName(name);
  store.delete(name);
}

export function clearAllSecrets(): void {
  store.clear();
}

// Belt-and-suspenders: even though tab close drops the module, register
// a listener so that `bfcache`-suspended pages and pages restored from
// the back-forward cache can't leak state into the next navigation.
if (typeof addEventListener === 'function') {
  addEventListener('pagehide', clearAllSecrets);
}

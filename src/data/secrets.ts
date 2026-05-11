// In-memory secret store for credentials (AI API keys, OAuth tokens, etc.).
//
// Storage model — memory-only via sessionStorage:
//   * Cleared on tab close. The user re-pastes the key per session.
//   * Never written to IndexedDB, never to a service-worker cache, never
//     to localStorage. This is the audit P1-#2 decision (phase-A audit):
//     "decide between in-memory, crypto.subtle-wrapped, or backend proxy
//     before TA.5/TA.6 wire it up" — we chose in-memory.
//   * If a future requirement demands cross-session persistence, replace
//     this module's body with a WebCrypto AES-GCM wrapper backed by IDB.
//     Callers do not need to change.
//
// Convention: `setSetting`/`getSetting` (in db.ts) must NEVER receive a
// credential — use this module instead. Reserved-prefix entries in
// sessionStorage isolate secrets from any other consumer.

export const SECRET_PREFIX = 'headway:secret:';

function assertName(name: string): void {
  if (!name) throw new Error('secret name must be a non-empty string');
}

export function setSecret(name: string, value: string): void {
  assertName(name);
  sessionStorage.setItem(SECRET_PREFIX + name, value);
}

export function getSecret(name: string): string | undefined {
  assertName(name);
  const raw = sessionStorage.getItem(SECRET_PREFIX + name);
  return raw === null ? undefined : raw;
}

export function clearSecret(name: string): void {
  assertName(name);
  sessionStorage.removeItem(SECRET_PREFIX + name);
}

export function clearAllSecrets(): void {
  const toRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key !== null && key.startsWith(SECRET_PREFIX)) toRemove.push(key);
  }
  for (const key of toRemove) sessionStorage.removeItem(key);
}

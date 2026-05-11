// Vitest global setup.
// 1) fake-indexeddb patches the global IndexedDB so production code runs
//    untouched in Node.
// 2) sessionStorage shim — Node has no Web Storage API; tests for the
//    secret store (src/data/secrets.ts) need a working sessionStorage.
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';

class MemoryStorage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

if (!('sessionStorage' in globalThis)) {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  globalThis.sessionStorage.clear();
});

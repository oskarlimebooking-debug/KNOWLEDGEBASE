// Thin async wrappers around IndexedDB for Sprint A.
// Phase G replaces these with Dexie; until then this file is the only
// place that talks to `indexedDB` directly. Keep it small and dependency-
// free so it can be lifted into a worker later if needed.

import { DB_NAME, DB_VERSION, STORES, STORE_SETTINGS, type StoreName } from './schema';

let dbPromise: Promise<IDBDatabase> | null = null;

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function runUpgrade(db: IDBDatabase): void {
  // v1 upgrade: only fires on first open (empty DB), so each store is
  // created unconditionally. When DB_VERSION bumps (Phase I), this body
  // becomes a switch on the old version.
  for (const spec of STORES) {
    const store = db.createObjectStore(spec.name, { keyPath: spec.keyPath });
    for (const idx of spec.indices) {
      store.createIndex(idx.name, idx.keyPath, { unique: false });
    }
  }
}

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => runUpgrade(req.result);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error(`Failed to open ${DB_NAME}`));
    req.onblocked = () => reject(new Error(`Open of ${DB_NAME} blocked by another connection`));
  });
  return dbPromise;
}

export async function closeDb(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise.catch(() => null);
  dbPromise = null;
  db?.close();
}

async function withStore<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return promisify(fn(db.transaction(store, mode).objectStore(store)));
}

export async function dbPut<T>(store: StoreName, value: T): Promise<void> {
  await withStore(store, 'readwrite', (s) => s.put(value as unknown as object));
}

export async function dbGet<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const result = await withStore<T | undefined>(store, 'readonly', (s) => s.get(key));
  return result ?? undefined;
}

export async function dbGetAll<T>(store: StoreName): Promise<T[]> {
  const result = await withStore<T[]>(store, 'readonly', (s) => s.getAll());
  return result ?? [];
}

export async function dbGetByIndex<T>(
  store: StoreName,
  indexName: string,
  value: IDBValidKey,
): Promise<T[]> {
  const result = await withStore<T[]>(store, 'readonly', (s) =>
    s.index(indexName).getAll(value),
  );
  return result ?? [];
}

export async function dbDelete(store: StoreName, key: IDBValidKey): Promise<void> {
  await withStore(store, 'readwrite', (s) => s.delete(key));
}

interface SettingRow {
  key: string;
  value: unknown;
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await dbGet<SettingRow>(STORE_SETTINGS, key);
  return row === undefined ? undefined : (row.value as T);
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await dbPut<SettingRow>(STORE_SETTINGS, { key, value });
}

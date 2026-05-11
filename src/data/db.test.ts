import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  DB_NAME,
  DB_VERSION,
  STORE_BOOKS,
  STORE_CHAPTERS,
  STORE_PROGRESS,
  STORE_GENERATED,
  STORE_SETTINGS,
} from './schema';
import {
  closeDb,
  dbDelete,
  dbGet,
  dbGetAll,
  dbGetByIndex,
  dbPut,
  getSetting,
  openDb,
  setSetting,
} from './db';

// Each test gets a fresh in-memory IDBFactory so state never leaks.
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

afterEach(async () => {
  await closeDb();
});

describe('schema', () => {
  it('exposes the documented database name + version', () => {
    expect(DB_NAME).toBe('ChapterWiseDB');
    expect(DB_VERSION).toBe(1);
  });
});

describe('openDb', () => {
  it('creates all five stores on first open', async () => {
    const db = await openDb();
    const names = Array.from(db.objectStoreNames).sort();
    expect(names).toEqual(
      [STORE_BOOKS, STORE_CHAPTERS, STORE_PROGRESS, STORE_GENERATED, STORE_SETTINGS].sort(),
    );
  });

  it('creates the documented indices', async () => {
    const db = await openDb();
    const tx = db.transaction(
      [STORE_BOOKS, STORE_CHAPTERS, STORE_PROGRESS, STORE_GENERATED],
      'readonly',
    );
    expect(Array.from(tx.objectStore(STORE_BOOKS).indexNames)).toContain('addedAt');
    expect(Array.from(tx.objectStore(STORE_CHAPTERS).indexNames)).toContain('bookId');
    const progressIdx = Array.from(tx.objectStore(STORE_PROGRESS).indexNames);
    expect(progressIdx).toEqual(expect.arrayContaining(['bookId', 'date']));
    expect(Array.from(tx.objectStore(STORE_GENERATED).indexNames)).toContain('chapterId');
  });

  it('returns the same connection on subsequent calls (idempotent)', async () => {
    const a = await openDb();
    const b = await openDb();
    expect(b).toBe(a);
  });

  it('reopens after closeDb', async () => {
    const a = await openDb();
    await closeDb();
    const b = await openDb();
    expect(b).not.toBe(a);
  });

  it('survives a simulated page refresh (close + reopen retains data)', async () => {
    await dbPut(STORE_BOOKS, {
      id: 'book_1',
      title: 'Persisted',
      addedAt: '2026-05-11T00:00:00Z',
    });
    await closeDb();
    const restored = await dbGet<{ id: string; title: string }>(STORE_BOOKS, 'book_1');
    expect(restored?.title).toBe('Persisted');
  });
});

describe('dbPut / dbGet', () => {
  it('round-trips a record by primary key', async () => {
    await dbPut(STORE_BOOKS, {
      id: 'book_1',
      title: 'Foo',
      addedAt: '2026-05-11T00:00:00Z',
    });
    const result = await dbGet<{ id: string; title: string }>(STORE_BOOKS, 'book_1');
    expect(result?.title).toBe('Foo');
  });

  it('overwrites on second put with the same key', async () => {
    await dbPut(STORE_BOOKS, { id: 'b', title: 'v1', addedAt: '2026-05-11' });
    await dbPut(STORE_BOOKS, { id: 'b', title: 'v2', addedAt: '2026-05-11' });
    const result = await dbGet<{ id: string; title: string }>(STORE_BOOKS, 'b');
    expect(result?.title).toBe('v2');
  });

  it('returns undefined for a missing key', async () => {
    const result = await dbGet(STORE_BOOKS, 'missing');
    expect(result).toBeUndefined();
  });
});

describe('dbGetAll', () => {
  it('returns every record in the store', async () => {
    await dbPut(STORE_BOOKS, { id: 'a', addedAt: '2026-05-09' });
    await dbPut(STORE_BOOKS, { id: 'b', addedAt: '2026-05-10' });
    await dbPut(STORE_BOOKS, { id: 'c', addedAt: '2026-05-11' });
    const all = await dbGetAll<{ id: string }>(STORE_BOOKS);
    expect(all.map((b) => b.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty array for an empty store', async () => {
    const all = await dbGetAll(STORE_GENERATED);
    expect(all).toEqual([]);
  });
});

describe('dbGetByIndex', () => {
  it('returns records matching the index value', async () => {
    await dbPut(STORE_CHAPTERS, { id: 'book_1_ch_0', bookId: 'book_1', index: 0 });
    await dbPut(STORE_CHAPTERS, { id: 'book_1_ch_1', bookId: 'book_1', index: 1 });
    await dbPut(STORE_CHAPTERS, { id: 'book_2_ch_0', bookId: 'book_2', index: 0 });

    const forBook1 = await dbGetByIndex<{ id: string }>(STORE_CHAPTERS, 'bookId', 'book_1');
    expect(forBook1.map((c) => c.id).sort()).toEqual(['book_1_ch_0', 'book_1_ch_1']);
  });

  it('returns an empty array when no records match', async () => {
    const result = await dbGetByIndex(STORE_CHAPTERS, 'bookId', 'no_such_book');
    expect(result).toEqual([]);
  });

  it('looks up by progress.date index', async () => {
    await dbPut(STORE_PROGRESS, {
      id: 'p1',
      bookId: 'book_1',
      chapterId: 'book_1_ch_0',
      completed: true,
      date: '2026-05-11',
    });
    await dbPut(STORE_PROGRESS, {
      id: 'p2',
      bookId: 'book_1',
      chapterId: 'book_1_ch_1',
      completed: true,
      date: '2026-05-10',
    });
    const today = await dbGetByIndex<{ id: string }>(STORE_PROGRESS, 'date', '2026-05-11');
    expect(today.map((p) => p.id)).toEqual(['p1']);
  });

  it('looks up generated artefacts by chapterId index', async () => {
    await dbPut(STORE_GENERATED, {
      id: 'summary_book_1_ch_0',
      chapterId: 'book_1_ch_0',
      type: 'summary',
      content: '...',
    });
    const forChapter = await dbGetByIndex<{ id: string }>(
      STORE_GENERATED,
      'chapterId',
      'book_1_ch_0',
    );
    expect(forChapter).toHaveLength(1);
  });
});

describe('dbDelete', () => {
  it('removes a record by primary key', async () => {
    await dbPut(STORE_BOOKS, { id: 'gone', addedAt: '2026-05-11' });
    await dbDelete(STORE_BOOKS, 'gone');
    const result = await dbGet(STORE_BOOKS, 'gone');
    expect(result).toBeUndefined();
  });

  it('is a no-op for a missing key', async () => {
    await expect(dbDelete(STORE_BOOKS, 'never_existed')).resolves.toBeUndefined();
  });
});

describe('error propagation', () => {
  it('rejects when an IDB request errors mid-transaction', async () => {
    // Force an error: dbPut into the settings store with a value that is
    // missing the keyPath ('key') — IndexedDB rejects the put.
    await expect(dbPut(STORE_SETTINGS, { notTheKey: 'oops' } as never)).rejects.toBeTruthy();
  });

  it('rejects openDb when indexedDB.open emits onerror', async () => {
    // Replace indexedDB with a stub whose `open` returns a request that
    // synchronously fires `onerror`. This exercises the openDb reject path.
    const real = globalThis.indexedDB;
    const fakeError = new Error('boom');
    globalThis.indexedDB = {
      open(): IDBOpenDBRequest {
        const req: Partial<IDBOpenDBRequest> & { error: Error } = { error: fakeError };
        queueMicrotask(() => {
          req.onerror?.(new Event('error') as Event);
        });
        return req as IDBOpenDBRequest;
      },
    } as unknown as IDBFactory;
    await closeDb();
    try {
      await expect(openDb()).rejects.toBe(fakeError);
    } finally {
      await closeDb();
      globalThis.indexedDB = real;
    }
  });

  it('rejects openDb when indexedDB.open emits onblocked', async () => {
    const real = globalThis.indexedDB;
    globalThis.indexedDB = {
      open(): IDBOpenDBRequest {
        const req: Partial<IDBOpenDBRequest> = {};
        queueMicrotask(() => {
          req.onblocked?.(new Event('blocked') as IDBVersionChangeEvent);
        });
        return req as IDBOpenDBRequest;
      },
    } as unknown as IDBFactory;
    await closeDb();
    try {
      await expect(openDb()).rejects.toThrow(/blocked/);
    } finally {
      await closeDb();
      globalThis.indexedDB = real;
    }
  });
});

describe('getSetting / setSetting', () => {
  it('round-trips a primitive value', async () => {
    await setSetting('readingSpeed', 250);
    expect(await getSetting<number>('readingSpeed')).toBe(250);
  });

  it('round-trips a complex object value', async () => {
    // NOTE: setSetting is for non-sensitive preferences only. Credentials
    // (API keys, OAuth tokens) must go through src/data/secrets.ts, which
    // keeps them in sessionStorage and out of IndexedDB. See phase-A
    // security audit P1-#2.
    const profile = { model: 'gemini-2.0', temperature: 0.4 };
    await setSetting('aiProfile', profile);
    expect(await getSetting<typeof profile>('aiProfile')).toEqual(profile);
  });

  it('overwrites an existing setting', async () => {
    await setSetting('k', 'v1');
    await setSetting('k', 'v2');
    expect(await getSetting<string>('k')).toBe('v2');
  });

  it('returns undefined for an unset key', async () => {
    expect(await getSetting('never_set')).toBeUndefined();
  });

  it('round-trips falsy values without confusing them with absence', async () => {
    await setSetting('flag', false);
    expect(await getSetting<boolean>('flag')).toBe(false);
    await setSetting('zero', 0);
    expect(await getSetting<number>('zero')).toBe(0);
    await setSetting('empty', '');
    expect(await getSetting<string>('empty')).toBe('');
  });
});

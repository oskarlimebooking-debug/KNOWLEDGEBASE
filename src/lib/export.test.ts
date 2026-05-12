import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { exportAllData, importAllData, EXPORT_VERSION } from './export';
import { dbGetAll, dbPut, closeDb, setSetting } from '../data/db';
import {
  STORE_BOOKS,
  STORE_CHAPTERS,
  STORE_PROGRESS,
  STORE_GENERATED,
} from '../data/schema';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

afterEach(async () => {
  await closeDb();
});

describe('exportAllData', () => {
  it('returns an empty payload for an empty DB', async () => {
    const payload = await exportAllData();
    expect(payload.version).toBe(EXPORT_VERSION);
    expect(payload.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(payload.books).toEqual([]);
    expect(payload.chapters).toEqual([]);
    expect(payload.progress).toEqual([]);
    expect(payload.generated).toEqual([]);
    expect(payload.settings).toEqual([]);
  });

  it('captures every store', async () => {
    await dbPut(STORE_BOOKS, { id: 'b1', title: 'B', addedAt: '2026-05-12' });
    await dbPut(STORE_CHAPTERS, { id: 'b1_ch_0', bookId: 'b1', index: 0, content: 'hello' });
    await dbPut(STORE_PROGRESS, { id: 'p1', bookId: 'b1', chapterId: 'b1_ch_0', completed: true, date: '2026-05-12' });
    await dbPut(STORE_GENERATED, { id: 'g1', chapterId: 'b1_ch_0', type: 'summary', content: '...' });
    await setSetting('readingSpeed', 250);

    const payload = await exportAllData();
    expect(payload.books).toHaveLength(1);
    expect(payload.chapters).toHaveLength(1);
    expect(payload.progress).toHaveLength(1);
    expect(payload.generated).toHaveLength(1);
    expect(payload.settings).toHaveLength(1);
  });
});

describe('importAllData', () => {
  it('refuses an unsupported version', async () => {
    await expect(
      importAllData({
        version: 99 as never,
        exportedAt: '',
        books: [],
        chapters: [],
        progress: [],
        generated: [],
        settings: [],
      }),
    ).rejects.toThrow(/Unsupported/);
  });

  it('round-trips: export → import → library identical', async () => {
    // Seed source DB.
    await dbPut(STORE_BOOKS, { id: 'b1', title: 'Source Book', addedAt: '2026-05-12' });
    await dbPut(STORE_CHAPTERS, { id: 'b1_ch_0', bookId: 'b1', index: 0, content: 'one' });
    await dbPut(STORE_CHAPTERS, { id: 'b1_ch_1', bookId: 'b1', index: 1, content: 'two' });
    await dbPut(STORE_PROGRESS, { id: 'p1', bookId: 'b1', chapterId: 'b1_ch_0', completed: true, date: '2026-05-12' });
    await setSetting('readingSpeed', 350);

    const exported = await exportAllData();

    // Wipe to a blank profile.
    await closeDb();
    globalThis.indexedDB = new IDBFactory();

    // Import.
    const result = await importAllData(exported);
    expect(result.imported.books).toBe(1);
    expect(result.imported.chapters).toBe(2);
    expect(result.imported.progress).toBe(1);
    expect(result.imported.settings).toBe(1);

    // Verify the new DB is structurally identical.
    expect(await dbGetAll(STORE_BOOKS)).toEqual(exported.books);
    expect(await dbGetAll(STORE_CHAPTERS)).toEqual(exported.chapters);
    expect(await dbGetAll(STORE_PROGRESS)).toEqual(exported.progress);
    expect(await dbGetAll(STORE_GENERATED)).toEqual(exported.generated);
  });

  it('reports per-store counts', async () => {
    const payload = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      books: [
        { id: 'b1', title: 'A', addedAt: '2026-05-12' },
        { id: 'b2', title: 'B', addedAt: '2026-05-12' },
      ],
      chapters: [
        { id: 'b1_ch_0', bookId: 'b1', index: 0, content: 'x' },
      ],
      progress: [],
      generated: [],
      settings: [{ key: 'readingSpeed', value: 250 }],
    };
    const result = await importAllData(payload);
    expect(result.imported).toEqual({
      books: 2,
      chapters: 1,
      progress: 0,
      generated: 0,
      settings: 1,
    });
  });
});

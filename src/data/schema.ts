// IndexedDB schema for ChapterWiseDB v1 (Sprint A).
// Five object stores keyed by their primary id (settings uses `key`).
// Index list — must match what onupgradeneeded creates in db.ts:
//   books.addedAt                  — library sort by recency
//   chapters.bookId                — list chapters for a book
//   progress.bookId                — list completion rows for a book
//   progress.date                  — streak / "today" lookups (YYYY-MM-DD)
//   generated.chapterId            — cached AI artefacts for a chapter
// Phase I renames `books` → `sources` and bumps DB_VERSION to 2.

export const DB_NAME = 'ChapterWiseDB';
export const DB_VERSION = 1;

export const STORE_BOOKS = 'books';
export const STORE_CHAPTERS = 'chapters';
export const STORE_PROGRESS = 'progress';
export const STORE_GENERATED = 'generated';
export const STORE_SETTINGS = 'settings';

export type StoreName =
  | typeof STORE_BOOKS
  | typeof STORE_CHAPTERS
  | typeof STORE_PROGRESS
  | typeof STORE_GENERATED
  | typeof STORE_SETTINGS;

export interface StoreSpec {
  name: StoreName;
  keyPath: string;
  indices: ReadonlyArray<{ name: string; keyPath: string }>;
}

// Source of truth for the upgrade path. db.ts iterates this.
export const STORES: ReadonlyArray<StoreSpec> = [
  { name: STORE_BOOKS, keyPath: 'id', indices: [{ name: 'addedAt', keyPath: 'addedAt' }] },
  { name: STORE_CHAPTERS, keyPath: 'id', indices: [{ name: 'bookId', keyPath: 'bookId' }] },
  {
    name: STORE_PROGRESS,
    keyPath: 'id',
    indices: [
      { name: 'bookId', keyPath: 'bookId' },
      { name: 'date', keyPath: 'date' },
    ],
  },
  { name: STORE_GENERATED, keyPath: 'id', indices: [{ name: 'chapterId', keyPath: 'chapterId' }] },
  { name: STORE_SETTINGS, keyPath: 'key', indices: [] },
];

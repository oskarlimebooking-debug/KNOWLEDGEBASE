// Cascade delete: book + its chapters + progress rows + generated artefacts.
//
// All four stores are touched inside a single readwrite transaction so
// the deletion is atomic — a failure anywhere rolls back every removal.
// Chapters and progress are looked up via their `bookId` index; generated
// rows live keyed by chapterId, so we resolve chapter ids first.

import { openDb } from '../data/db';
import {
  STORE_BOOKS,
  STORE_CHAPTERS,
  STORE_GENERATED,
  STORE_PROGRESS,
} from '../data/schema';

interface Indexable {
  id: string;
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IDB request failed'));
  });
}

export async function deleteBookCascade(bookId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(
    [STORE_BOOKS, STORE_CHAPTERS, STORE_PROGRESS, STORE_GENERATED],
    'readwrite',
  );
  const booksStore = tx.objectStore(STORE_BOOKS);
  const chaptersStore = tx.objectStore(STORE_CHAPTERS);
  const progressStore = tx.objectStore(STORE_PROGRESS);
  const generatedStore = tx.objectStore(STORE_GENERATED);

  // Resolve chapter ids for this book first (we need them to delete
  // the generated rows keyed on chapterId).
  const chapterRows = await requestToPromise<Indexable[]>(
    chaptersStore.index('bookId').getAll(bookId) as IDBRequest<Indexable[]>,
  );
  const progressRows = await requestToPromise<Indexable[]>(
    progressStore.index('bookId').getAll(bookId) as IDBRequest<Indexable[]>,
  );

  for (const ch of chapterRows) {
    chaptersStore.delete(ch.id);
    const genRows = await requestToPromise<Indexable[]>(
      generatedStore.index('chapterId').getAll(ch.id) as IDBRequest<Indexable[]>,
    );
    for (const g of genRows) generatedStore.delete(g.id);
  }
  for (const p of progressRows) progressStore.delete(p.id);
  booksStore.delete(bookId);

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IDB transaction error'));
    tx.onabort = () => reject(tx.error ?? new Error('IDB transaction aborted'));
  });
}

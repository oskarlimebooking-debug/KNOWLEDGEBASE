// IDB writer — saves a book and its chapters in a single transaction.
//
// Audit / AC: "Save commits all rows in a single IDB transaction;
// partial failure rolls back." A single `db.transaction([books,
// chapters], 'readwrite')` gives IDB's natural rollback semantics —
// if any put errors, the whole transaction aborts and no rows persist.

import { openDb } from '../../data/db';
import { STORE_BOOKS, STORE_CHAPTERS } from '../../data/schema';
import type { ImportedBook } from './types';

export async function saveImportedBook(imported: ImportedBook): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([STORE_BOOKS, STORE_CHAPTERS], 'readwrite');
  const booksStore = tx.objectStore(STORE_BOOKS);
  const chaptersStore = tx.objectStore(STORE_CHAPTERS);

  // Wrap puts so any synchronous IDB error (e.g. missing keyPath on a
  // value) aborts the transaction — the book row queued earlier in this
  // loop must NOT survive a chapter-level failure. Without an explicit
  // tx.abort, IDB would still commit successfully-queued requests.
  try {
    booksStore.put(imported.book as unknown as object);
    for (const ch of imported.chapters) {
      chaptersStore.put(ch as unknown as object);
    }
  } catch (err) {
    try {
      tx.abort();
    } catch {
      // Transaction may already be in a terminal state.
    }
    throw err;
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IDB transaction error'));
    tx.onabort = () => reject(tx.error ?? new Error('IDB transaction aborted'));
  });
}

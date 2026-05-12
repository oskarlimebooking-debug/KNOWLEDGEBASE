// Data export / import.
//
// Round-trips the entire ChapterWiseDB to a single JSON document and
// back. `version` is the wire format version — bump when the payload
// shape changes incompatibly so importers can detect and refuse.
//
// Audit note: the payload includes the settings store. If a future
// migration moves credentials into `settings`, exclude them here —
// the secrets store (src/data/secrets.ts) is intentionally not in IDB.

import { dbGetAll, dbPut } from '../data/db';
import {
  STORE_BOOKS,
  STORE_CHAPTERS,
  STORE_GENERATED,
  STORE_PROGRESS,
  STORE_SETTINGS,
  type StoreName,
} from '../data/schema';

export interface ExportPayload {
  version: 1;
  exportedAt: string;
  books: ReadonlyArray<Record<string, unknown>>;
  chapters: ReadonlyArray<Record<string, unknown>>;
  progress: ReadonlyArray<Record<string, unknown>>;
  generated: ReadonlyArray<Record<string, unknown>>;
  settings: ReadonlyArray<Record<string, unknown>>;
}

export const EXPORT_VERSION = 1 as const;

export async function exportAllData(): Promise<ExportPayload> {
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    books: await dbGetAll<Record<string, unknown>>(STORE_BOOKS),
    chapters: await dbGetAll<Record<string, unknown>>(STORE_CHAPTERS),
    progress: await dbGetAll<Record<string, unknown>>(STORE_PROGRESS),
    generated: await dbGetAll<Record<string, unknown>>(STORE_GENERATED),
    settings: await dbGetAll<Record<string, unknown>>(STORE_SETTINGS),
  };
}

export interface ImportResult {
  imported: Record<StoreName, number>;
}

export async function importAllData(payload: ExportPayload): Promise<ImportResult> {
  if (payload.version !== EXPORT_VERSION) {
    throw new Error(`Unsupported export version: ${payload.version}`);
  }
  const counts: Record<StoreName, number> = {
    books: 0,
    chapters: 0,
    progress: 0,
    generated: 0,
    settings: 0,
  };
  for (const row of payload.books) {
    await dbPut(STORE_BOOKS, row);
    counts.books++;
  }
  for (const row of payload.chapters) {
    await dbPut(STORE_CHAPTERS, row);
    counts.chapters++;
  }
  for (const row of payload.progress) {
    await dbPut(STORE_PROGRESS, row);
    counts.progress++;
  }
  for (const row of payload.generated) {
    await dbPut(STORE_GENERATED, row);
    counts.generated++;
  }
  for (const row of payload.settings) {
    await dbPut(STORE_SETTINGS, row);
    counts.settings++;
  }
  return { imported: counts };
}

export function downloadAsJson(payload: ExportPayload, doc: Document = document): void {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  const date = payload.exportedAt.slice(0, 10);
  a.download = `headway-export-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

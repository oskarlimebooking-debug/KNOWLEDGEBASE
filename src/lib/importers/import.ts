// Book import dispatcher.
//
// importBook(file): picks the parser based on file extension/MIME,
// extracts the text, splits into chapters, generates a cover, and
// persists the book + chapters in a single IDB transaction.

import { parseEpub } from './epub';
import { parsePdf, pdfShouldSkipCover } from './pdf';
import { splitIntoChapters } from './chapters';
import { emojiFromKeyword, generateTextCover } from './cover';
import { saveImportedBook } from './save';
import type { Book, Chapter, ImportedBook, ParsedBookText } from './types';

export type FileSource = 'epub' | 'pdf';

export function detectFileSource(file: { name: string; type: string }): FileSource | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.epub') || file.type === 'application/epub+zip') return 'epub';
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  return null;
}

function makeBookId(): string {
  return `book_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeChapterId(bookId: string, index: number): string {
  return `${bookId}_ch_${index}`;
}

export interface ImportOptions {
  wordsPerChapter?: number;
  // Override `document` for tests / non-DOM environments.
  doc?: Document;
}

export async function importBook(
  file: File,
  options: ImportOptions = {},
): Promise<ImportedBook> {
  const source = detectFileSource(file);
  if (source === null) {
    throw new Error(`Unsupported file type: ${file.name}`);
  }

  const parsed: ParsedBookText =
    source === 'epub' ? await parseEpub(file) : await parsePdf(file);

  const slices = splitIntoChapters(parsed.content, options.wordsPerChapter);
  const bookId = makeBookId();

  // PDFs over the size threshold skip canvas cover generation (memory).
  const skipCover = source === 'pdf' && pdfShouldSkipCover(file);
  const coverDataUrl = skipCover
    ? null
    : safeGenerateCover(parsed.title, options.doc);

  const book: Book = {
    id: bookId,
    title: parsed.title,
    author: parsed.author,
    addedAt: new Date().toISOString(),
    coverDataUrl,
    source: parsed.source,
    chapterCount: slices.length,
  };

  const chapters: Chapter[] = slices.map((s) => ({
    id: makeChapterId(bookId, s.index),
    bookId,
    index: s.index,
    title: s.title,
    content: s.content,
  }));

  const imported: ImportedBook = { book, chapters };
  await saveImportedBook(imported);
  return imported;
}

function safeGenerateCover(title: string, doc?: Document): string | null {
  if (doc === undefined && typeof document === 'undefined') return null;
  return generateTextCover(title, doc);
}

// Exposed for the UI fallback when coverDataUrl is null.
export { emojiFromKeyword };

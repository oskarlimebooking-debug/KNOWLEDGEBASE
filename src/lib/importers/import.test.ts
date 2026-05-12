import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import JSZip from 'jszip';
import { detectFileSource, importBook } from './import';
import { closeDb, dbGet, dbGetByIndex } from '../../data/db';
import { STORE_BOOKS, STORE_CHAPTERS } from '../../data/schema';
import type { Book, Chapter } from './types';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

afterEach(async () => {
  await closeDb();
});

async function makeEpubFile(title: string, chapters: string[]): Promise<File> {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  zip.file(
    'META-INF/container.xml',
    '<rootfiles><rootfile full-path="c.opf" media-type="x"/></rootfiles>',
  );
  const manifest = chapters
    .map((_, i) => `<item id="ch${i}" href="ch${i}.xhtml"/>`)
    .join('');
  const spine = chapters.map((_, i) => `<itemref idref="ch${i}"/>`).join('');
  zip.file(
    'c.opf',
    `<package><metadata xmlns:dc="x"><dc:title>${title}</dc:title></metadata>
     <manifest>${manifest}</manifest><spine>${spine}</spine></package>`,
  );
  chapters.forEach((html, i) => zip.file(`ch${i}.xhtml`, html));
  const blob = await zip.generateAsync({ type: 'blob' });
  return new File([blob], `${title.toLowerCase()}.epub`, { type: 'application/epub+zip' });
}

describe('detectFileSource', () => {
  it('detects EPUB by extension', () => {
    expect(detectFileSource({ name: 'book.epub', type: '' })).toBe('epub');
  });

  it('detects EPUB by MIME', () => {
    expect(detectFileSource({ name: 'noext', type: 'application/epub+zip' })).toBe('epub');
  });

  it('detects PDF by extension and MIME', () => {
    expect(detectFileSource({ name: 'book.pdf', type: '' })).toBe('pdf');
    expect(detectFileSource({ name: 'x', type: 'application/pdf' })).toBe('pdf');
  });

  it('returns null for unsupported types', () => {
    expect(detectFileSource({ name: 'book.txt', type: 'text/plain' })).toBeNull();
  });
});

describe('importBook (EPUB)', () => {
  it('imports an EPUB, splits into chapters, and persists to IDB', async () => {
    // Two chapters worth of content, each below 200 words.
    const file = await makeEpubFile('Mini', [
      `<p>${'one '.repeat(50)}</p>`,
      `<p>${'two '.repeat(50)}</p>`,
    ]);
    const imported = await importBook(file, { wordsPerChapter: 100 });

    expect(imported.book.title).toBe('Mini');
    expect(imported.book.source).toBe('epub');
    expect(imported.chapters.length).toBeGreaterThanOrEqual(1);

    const fromDb = await dbGet<Book>(STORE_BOOKS, imported.book.id);
    expect(fromDb?.title).toBe('Mini');

    const dbChapters = await dbGetByIndex<Chapter>(STORE_CHAPTERS, 'bookId', imported.book.id);
    expect(dbChapters).toHaveLength(imported.chapters.length);
  });

  it('always assigns chapter ids of the form <bookId>_ch_<index>', async () => {
    const file = await makeEpubFile('IDTest', ['<p>one</p>']);
    const imported = await importBook(file);
    for (const ch of imported.chapters) {
      expect(ch.id).toBe(`${imported.book.id}_ch_${ch.index}`);
    }
  });

  it('stores coverDataUrl=null when canvas is unavailable (test env)', async () => {
    const file = await makeEpubFile('NoCover', ['<p>x</p>']);
    const imported = await importBook(file);
    // canvas is unavailable in our stub Document → null cover.
    expect(imported.book.coverDataUrl).toBeNull();
  });
});

describe('importBook (PDF stub)', () => {
  it('stores the stubbed PDF book and surfaces source=pdf', async () => {
    const file = new File([new Uint8Array(1024)], 'doc.pdf', { type: 'application/pdf' });
    const imported = await importBook(file);
    expect(imported.book.source).toBe('pdf');
    expect(imported.chapters).toHaveLength(1);
  });

  it('skips cover when PDF exceeds 5 MB', async () => {
    // A real >5 MB Uint8Array is heavy; use a Blob-shape proxy via File
    // with stub size; importBook reads file.size for the gate.
    const big = new File([new Uint8Array(6 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' });
    const imported = await importBook(big);
    expect(imported.book.coverDataUrl).toBeNull();
  });
});

describe('importBook (errors)', () => {
  it('throws on unsupported file types', async () => {
    const txt = new File(['hello'], 'note.txt', { type: 'text/plain' });
    await expect(importBook(txt)).rejects.toThrow(/Unsupported/);
  });
});

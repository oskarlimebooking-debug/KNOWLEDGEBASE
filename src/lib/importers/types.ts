// Importer types shared by the EPUB / PDF parsers and the IDB writer.

export interface Book {
  id: string;
  title: string;
  author: string | null;
  addedAt: string;
  coverDataUrl: string | null;
  source: 'epub' | 'pdf';
  chapterCount: number;
}

export interface Chapter {
  id: string;
  bookId: string;
  index: number;
  title: string;
  content: string;
}

export interface ImportedBook {
  book: Book;
  chapters: Chapter[];
}

// Intermediate shape returned by a parser before chapter splitting.
export interface ParsedBookText {
  title: string;
  author: string | null;
  content: string;
  source: Book['source'];
}

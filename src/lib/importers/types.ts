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
  /** Difficulty 1-5, written back by Summary mode (TB.5). Library cards
   *  show stars derived from per-chapter difficulty across the book. */
  difficulty?: number;
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

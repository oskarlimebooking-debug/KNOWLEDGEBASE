// Library aggregations: progress, streaks, daily-suggestion, difficulty.
//
// Pure data helpers — no DOM, no IDB. The UI layer (src/ui/library.ts)
// hydrates these from IDB and passes them to the renderer.

import type { Book, Chapter } from './importers/types';

export interface ProgressRow {
  id: string;
  bookId: string;
  chapterId: string;
  completed: boolean;
  date: string; // YYYY-MM-DD
}

export interface BookSummary {
  book: Book;
  completedCount: number;
  progressPct: number; // 0..1
  nextChapterIndex: number | null;
  /** Average chapter.difficulty across chapters that have it set.
   *  `null` when no chapter has been summarised yet (TB.5 writeback). */
  averageDifficulty: number | null;
}

export function summarizeBook(
  book: Book,
  chapters: ReadonlyArray<Chapter>,
  progress: ReadonlyArray<ProgressRow>,
): BookSummary {
  const completedIds = new Set<string>();
  for (const p of progress) {
    if (p.bookId === book.id && p.completed) completedIds.add(p.chapterId);
  }
  const total = book.chapterCount;
  const completedCount = completedIds.size;
  const progressPct = total === 0 ? 0 : Math.min(1, completedCount / total);

  let nextChapterIndex: number | null = null;
  for (let i = 0; i < total; i++) {
    if (!completedIds.has(`${book.id}_ch_${i}`)) {
      nextChapterIndex = i;
      break;
    }
  }

  // Average difficulty across chapters that have it. Scoped to this book.
  const withDiff = chapters.filter(
    (c) => c.bookId === book.id && typeof c.difficulty === 'number' && Number.isFinite(c.difficulty),
  );
  const averageDifficulty =
    withDiff.length > 0
      ? withDiff.reduce((sum, c) => sum + (c.difficulty as number), 0) / withDiff.length
      : null;

  return { book, completedCount, progressPct, nextChapterIndex, averageDifficulty };
}

export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function previousDate(yyyymmdd: string): string {
  const d = new Date(`${yyyymmdd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function computeStreak(
  progress: ReadonlyArray<ProgressRow>,
  today: string = todayUtc(),
): number {
  const dates = new Set<string>();
  for (const p of progress) {
    if (p.completed) dates.add(p.date);
  }
  let streak = 0;
  let cur = today;
  while (dates.has(cur)) {
    streak++;
    cur = previousDate(cur);
  }
  return streak;
}

export interface DailySuggestion {
  book: Book;
  chapter: Chapter;
  summary: BookSummary;
}

export function pickDailyChapter(
  books: ReadonlyArray<Book>,
  chapters: ReadonlyArray<Chapter>,
  progress: ReadonlyArray<ProgressRow>,
): DailySuggestion | null {
  if (books.length === 0) return null;

  // Most recently opened = latest progress.date for that book; fallback
  // to the book's addedAt timestamp.
  const lastByBook = new Map<string, string>();
  for (const p of progress) {
    const existing = lastByBook.get(p.bookId);
    if (existing === undefined || p.date > existing) lastByBook.set(p.bookId, p.date);
  }

  const ordered = [...books].sort((a, b) => {
    const aKey = lastByBook.get(a.id) ?? a.addedAt;
    const bKey = lastByBook.get(b.id) ?? b.addedAt;
    return bKey.localeCompare(aKey);
  });

  for (const book of ordered) {
    const bookChapters = chapters.filter((c) => c.bookId === book.id);
    const summary = summarizeBook(book, bookChapters, progress);
    if (summary.nextChapterIndex === null) continue;
    const chapterId = `${book.id}_ch_${summary.nextChapterIndex}`;
    const chapter = chapters.find((c) => c.id === chapterId);
    if (chapter !== undefined) return { book, chapter, summary };
  }
  return null;
}

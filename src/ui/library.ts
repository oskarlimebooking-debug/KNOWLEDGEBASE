// Library view.
//
// Renders into the `.view-library__pane` container:
//   - "+ Add Book" button + hidden file input (file picker).
//   - Streak chip ("🔥 N days").
//   - Daily card (today's suggested chapter).
//   - Book grid: cover / title / author / progress bar.
//   - Empty state when zero books in IDB.
//
// On book card click: setView('book') and fires the registered
// `onBookClick(bookId)` so TA.6 (Book detail) can render into the book
// pane. TA.5 stores the click target id via dataset so the host can
// pick it up.

import { dbGetAll } from '../data/db';
import {
  computeStreak,
  pickDailyChapter,
  summarizeBook,
  todayUtc,
  type BookSummary,
  type DailySuggestion,
  type ProgressRow,
} from '../lib/library-data';
import { importBook } from '../lib/importers/import';
import type { Book, Chapter } from '../lib/importers/types';
import { emojiFromKeyword } from '../lib/importers/cover';
import {
  STORE_BOOKS,
  STORE_CHAPTERS,
  STORE_PROGRESS,
} from '../data/schema';
import { buildElement, type ShellNode } from './dom';
import { setView } from './view';
import { showToast } from './toast';

export interface LibraryData {
  summaries: BookSummary[];
  daily: DailySuggestion | null;
  streak: number;
}

type BookClickHandler = (bookId: string) => void;

let bookClickHandler: BookClickHandler | null = null;
export function setBookClickHandler(fn: BookClickHandler): void {
  bookClickHandler = fn;
}

async function loadLibraryData(today: string = todayUtc()): Promise<LibraryData> {
  const books = await dbGetAll<Book>(STORE_BOOKS);
  const chapters = await dbGetAll<Chapter>(STORE_CHAPTERS);
  const progress = await dbGetAll<ProgressRow>(STORE_PROGRESS);
  const summaries = books.map((b) =>
    summarizeBook(b, chapters.filter((c) => c.bookId === b.id), progress),
  );
  const daily = pickDailyChapter(books, chapters, progress);
  const streak = computeStreak(progress, today);
  return { summaries, daily, streak };
}

function difficultyStars(level: number): string {
  const clamped = Math.max(0, Math.min(5, Math.round(level)));
  return '★'.repeat(clamped) + '☆'.repeat(5 - clamped);
}

function bookCard(summary: BookSummary): ShellNode {
  const { book, progressPct, averageDifficulty } = summary;
  const pct = Math.round(progressPct * 100);
  const cover: ShellNode =
    book.coverDataUrl !== null
      ? {
          tag: 'img',
          className: 'book-card__cover',
          attrs: {
            src: book.coverDataUrl,
            alt: '',
            width: '120',
            height: '160',
            loading: 'lazy',
          },
        }
      : {
          tag: 'div',
          className: 'book-card__cover book-card__cover--placeholder',
          attrs: { 'aria-hidden': 'true' },
          children: [emojiFromKeyword(book.title)],
        };

  return {
    tag: 'button',
    className: 'book-card',
    attrs: { type: 'button', 'data-book-id': book.id },
    children: [
      cover,
      {
        tag: 'div',
        className: 'book-card__meta',
        children: [
          { tag: 'h3', className: 'book-card__title', children: [book.title] },
          ...(book.author !== null
            ? [{
                tag: 'p',
                className: 'book-card__author',
                children: [book.author],
              } as ShellNode]
            : []),
          {
            tag: 'div',
            className: 'book-card__progress',
            attrs: { role: 'progressbar', 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100' },
            children: [
              {
                tag: 'div',
                className: 'book-card__progress-bar',
                attrs: { style: `width:${pct}%` },
              },
            ],
          },
          { tag: 'span', className: 'book-card__progress-label', children: [`${pct}%`] },
          ...(averageDifficulty !== null
            ? [{
                tag: 'span',
                className: 'book-card__difficulty',
                attrs: {
                  'aria-label': `Difficulty ${averageDifficulty.toFixed(1)} out of 5`,
                  'data-difficulty': averageDifficulty.toFixed(2),
                },
                children: [difficultyStars(averageDifficulty)],
              } as ShellNode]
            : []),
        ],
      },
    ],
  };
}

function dailyCard(daily: DailySuggestion | null): ShellNode | null {
  if (daily === null) return null;
  return {
    tag: 'div',
    className: 'daily-card',
    attrs: { 'data-role': 'daily-card', 'data-book-id': daily.book.id },
    children: [
      { tag: 'span', className: 'daily-card__label', children: ['Today'] },
      {
        tag: 'h2',
        className: 'daily-card__chapter',
        children: [daily.chapter.title],
      },
      { tag: 'p', className: 'daily-card__book', children: [daily.book.title] },
    ],
  };
}

function streakChip(streak: number): ShellNode {
  return {
    tag: 'div',
    className: 'streak-chip',
    attrs: { 'data-role': 'streak' },
    children: [
      { tag: 'span', className: 'streak-chip__icon', attrs: { 'aria-hidden': 'true' }, children: ['🔥'] },
      { tag: 'span', className: 'streak-chip__count', children: [`${streak} day${streak === 1 ? '' : 's'}`] },
    ],
  };
}

function emptyState(): ShellNode {
  return {
    tag: 'div',
    className: 'library-empty',
    attrs: { 'data-role': 'empty-state' },
    children: [
      { tag: 'span', className: 'library-empty__icon', attrs: { 'aria-hidden': 'true' }, children: ['📚'] },
      { tag: 'h2', className: 'library-empty__title', children: ['Add your first book'] },
      {
        tag: 'p',
        className: 'library-empty__hint',
        children: ['Pick a PDF or EPUB to get started.'],
      },
    ],
  };
}

function libraryHeaderControls(): ShellNode {
  return {
    tag: 'div',
    className: 'library__controls',
    children: [
      {
        tag: 'button',
        className: 'library__add',
        attrs: { type: 'button', 'data-role': 'add-book' },
        children: ['+ Add Book'],
      },
      {
        tag: 'input',
        className: 'library__file-input',
        attrs: {
          type: 'file',
          accept: '.pdf,.epub,application/pdf,application/epub+zip',
          'data-role': 'file-input',
          hidden: '',
        },
      },
    ],
  };
}

export function renderLibrary(data: LibraryData): ShellNode {
  const children: ShellNode[] = [libraryHeaderControls()];
  if (data.summaries.length === 0) {
    children.push(emptyState());
    return { tag: 'div', className: 'library', children };
  }
  children.push(streakChip(data.streak));
  const daily = dailyCard(data.daily);
  if (daily !== null) children.push(daily);
  children.push({
    tag: 'div',
    className: 'library__grid',
    attrs: { 'data-role': 'book-grid' },
    children: data.summaries.map(bookCard),
  });
  return { tag: 'div', className: 'library', children };
}

export function wireLibrary(pane: HTMLElement, toastContainer: HTMLElement): void {
  const addBtn = pane.querySelector('.library__add') as HTMLElement | null;
  const input = pane.querySelector('.library__file-input') as HTMLInputElement | null;
  if (addBtn !== null && input !== null) {
    addBtn.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      const file = input.files?.[0] ?? null;
      if (file === null) return;
      void importBook(file).then(
        async (imported) => {
          showToast(toastContainer, `Added "${imported.book.title}".`, 'success');
          input.value = '';
          await refreshLibrary(pane, toastContainer);
        },
        (err: Error) => {
          showToast(toastContainer, `Import failed: ${err.message}`, 'error');
          input.value = '';
        },
      );
    });
  }

  const grid = pane.querySelector('.library__grid') as HTMLElement | null;
  if (grid !== null) {
    grid.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      const card = target?.closest('.book-card') as HTMLElement | null;
      const id = card?.dataset.bookId;
      if (id !== undefined && bookClickHandler !== null) {
        setView(pane.closest('.app') as HTMLElement, 'book');
        bookClickHandler(id);
      }
    });
  }
}

export async function refreshLibrary(
  pane: HTMLElement,
  toastContainer: HTMLElement,
): Promise<void> {
  const data = await loadLibraryData();
  const node = buildElement(renderLibrary(data));
  pane.replaceChildren(node);
  wireLibrary(pane, toastContainer);
}

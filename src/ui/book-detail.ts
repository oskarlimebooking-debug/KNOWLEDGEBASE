// Book detail view.
//
// Header: cover, title, author. Below that: "X / Y chapters complete"
// progress bar. Then a clickable chapter list (each row shows index,
// title, ✓ when completed). At the bottom: Delete Book button which
// opens a confirmation modal (Escape cancels — see openConfirm below).

import { dbGet, dbGetByIndex } from '../data/db';
import { STORE_BOOKS, STORE_CHAPTERS, STORE_PROGRESS } from '../data/schema';
import type { Book, Chapter } from '../lib/importers/types';
import { deleteBookCascade } from '../lib/delete-book';
import { emojiFromKeyword } from '../lib/importers/cover';
import {
  summarizeBook,
  type ProgressRow,
} from '../lib/library-data';
import { buildElement, type ShellNode } from './dom';
import { setView } from './view';
import { showToast } from './toast';
import { openConfirm } from './confirm';

type ChapterClickHandler = (bookId: string, chapterId: string) => void;

let chapterClickHandler: ChapterClickHandler | null = null;
export function setChapterClickHandler(fn: ChapterClickHandler): void {
  chapterClickHandler = fn;
}

let onAfterDelete: (() => void | Promise<void>) | null = null;
export function setOnBookDeleted(fn: () => void | Promise<void>): void {
  onAfterDelete = fn;
}

export interface BookDetailData {
  book: Book;
  chapters: Chapter[];
  progress: ProgressRow[];
}

async function loadBookDetail(bookId: string): Promise<BookDetailData | null> {
  const book = await dbGet<Book>(STORE_BOOKS, bookId);
  if (book === undefined) return null;
  const chapters = await dbGetByIndex<Chapter>(STORE_CHAPTERS, 'bookId', bookId);
  const progress = await dbGetByIndex<ProgressRow>(STORE_PROGRESS, 'bookId', bookId);
  chapters.sort((a, b) => a.index - b.index);
  return { book, chapters, progress };
}

function chapterRow(ch: Chapter, completed: boolean): ShellNode {
  return {
    tag: 'button',
    className: `chapter-row${completed ? ' chapter-row--done' : ''}`,
    attrs: {
      type: 'button',
      'data-chapter-id': ch.id,
      'data-book-id': ch.bookId,
      'aria-pressed': completed ? 'true' : 'false',
    },
    children: [
      {
        tag: 'span',
        className: 'chapter-row__index',
        children: [String(ch.index + 1)],
      },
      { tag: 'span', className: 'chapter-row__title', children: [ch.title] },
      ...(completed
        ? [{
            tag: 'span',
            className: 'chapter-row__check',
            attrs: { 'aria-label': 'Completed' },
            children: ['✓'],
          } as ShellNode]
        : []),
    ],
  };
}

export function renderBookDetail(data: BookDetailData): ShellNode {
  const summary = summarizeBook(data.book, data.progress);
  const pct = Math.round(summary.progressPct * 100);
  const cover: ShellNode =
    data.book.coverDataUrl !== null
      ? {
          tag: 'img',
          className: 'book-detail__cover',
          attrs: { src: data.book.coverDataUrl, alt: '', width: '160', height: '210' },
        }
      : {
          tag: 'div',
          className: 'book-detail__cover book-detail__cover--placeholder',
          attrs: { 'aria-hidden': 'true' },
          children: [emojiFromKeyword(data.book.title)],
        };

  const completedIds = new Set<string>();
  for (const p of data.progress) if (p.completed) completedIds.add(p.chapterId);

  return {
    tag: 'div',
    className: 'book-detail',
    attrs: { 'data-book-id': data.book.id },
    children: [
      {
        tag: 'div',
        className: 'book-detail__head',
        children: [
          cover,
          {
            tag: 'div',
            className: 'book-detail__meta',
            children: [
              { tag: 'h2', className: 'book-detail__title', children: [data.book.title] },
              ...(data.book.author !== null
                ? [{
                    tag: 'p',
                    className: 'book-detail__author',
                    children: [data.book.author],
                  } as ShellNode]
                : []),
              {
                tag: 'p',
                className: 'book-detail__progress-text',
                children: [`${summary.completedCount} / ${data.book.chapterCount} chapters complete`],
              },
              {
                tag: 'div',
                className: 'book-detail__progress',
                attrs: {
                  role: 'progressbar',
                  'aria-valuenow': String(pct),
                  'aria-valuemin': '0',
                  'aria-valuemax': '100',
                },
                children: [
                  {
                    tag: 'div',
                    className: 'book-detail__progress-bar',
                    attrs: { style: `width:${pct}%` },
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        tag: 'div',
        className: 'book-detail__chapters',
        attrs: { 'data-role': 'chapter-list' },
        children: data.chapters.map((ch) => chapterRow(ch, completedIds.has(ch.id))),
      },
      {
        tag: 'button',
        className: 'book-detail__delete',
        attrs: { type: 'button', 'data-role': 'delete-book' },
        children: ['Delete Book'],
      },
    ],
  };
}

function wireBookDetail(
  pane: HTMLElement,
  data: BookDetailData,
  toastContainer: HTMLElement,
  modalStack: HTMLElement,
): void {
  const list = pane.querySelector('.book-detail__chapters') as HTMLElement | null;
  if (list !== null) {
    list.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      const row = target?.closest('.chapter-row') as HTMLElement | null;
      const chId = row?.dataset.chapterId;
      const bookId = row?.dataset.bookId;
      if (chId !== undefined && bookId !== undefined && chapterClickHandler !== null) {
        setView(pane.closest('.app') as HTMLElement, 'chapter');
        chapterClickHandler(bookId, chId);
      }
    });
  }

  const deleteBtn = pane.querySelector('.book-detail__delete') as HTMLElement | null;
  deleteBtn?.addEventListener('click', () => {
    void openConfirm(modalStack, {
      title: 'Delete book?',
      message: `This will permanently remove "${data.book.title}" and all its chapters, progress, and AI-generated content.`,
      confirmLabel: 'Delete',
      destructive: true,
    }).then(async (confirmed) => {
      if (!confirmed) return;
      try {
        await deleteBookCascade(data.book.id);
        showToast(toastContainer, `Deleted "${data.book.title}".`, 'success');
        if (onAfterDelete !== null) await onAfterDelete();
      } catch (err) {
        showToast(toastContainer, `Delete failed: ${(err as Error).message}`, 'error');
      }
    });
  });
}

export async function showBookDetail(
  bookId: string,
  pane: HTMLElement,
  toastContainer: HTMLElement,
  modalStack: HTMLElement,
): Promise<boolean> {
  const data = await loadBookDetail(bookId);
  if (data === null) {
    pane.replaceChildren();
    showToast(toastContainer, 'Book not found.', 'error');
    return false;
  }
  pane.replaceChildren(buildElement(renderBookDetail(data)));
  wireBookDetail(pane, data, toastContainer, modalStack);
  return true;
}

// Chapter view — Read mode only.
//
// Header with chapter title. Body renders `chapter.content` paragraph-
// by-paragraph (split on blank lines) so the original layout survives.
// Footer holds Prev / Next nav and a Mark Complete button.
//
// AC "No layout shift after mark-complete": the button keeps its
// dimensions and merely flips its label + state; the action row above
// it has a fixed grid template.

import { dbGet, dbGetByIndex, dbPut } from '../data/db';
import {
  STORE_CHAPTERS,
  STORE_PROGRESS,
} from '../data/schema';
import type { Chapter } from '../lib/importers/types';
import {
  todayUtc,
  type ProgressRow,
} from '../lib/library-data';
import { buildElement, type ShellNode } from './dom';
import { showSummary } from './summary-view';
import { showToast } from './toast';

export type ChapterMode = 'read' | 'summary';

// Callback fired after a summary writes back chapter.difficulty.
// `app.ts` wires this to a library refresh so the book card's
// averageDifficulty (and thus its star row) re-renders.
type SummaryWritebackHandler = () => void | Promise<void>;
let summaryWritebackHandler: SummaryWritebackHandler | null = null;
export function setSummaryWritebackHandler(fn: SummaryWritebackHandler): void {
  summaryWritebackHandler = fn;
}

type NavigateToChapter = (bookId: string, chapterId: string) => void;

let navigateHandler: NavigateToChapter | null = null;
export function setChapterNavigateHandler(fn: NavigateToChapter): void {
  navigateHandler = fn;
}

export interface ChapterViewData {
  chapter: Chapter;
  prevId: string | null;
  nextId: string | null;
  completed: boolean;
}

export function splitParagraphs(content: string): string[] {
  if (content.trim() === '') return [];
  return content.split(/\n\s*\n/).map((p) => p.replace(/^\s+|\s+$/g, ''));
}

async function loadChapterView(chapterId: string): Promise<ChapterViewData | null> {
  const chapter = await dbGet<Chapter>(STORE_CHAPTERS, chapterId);
  if (chapter === undefined) return null;
  const siblings = await dbGetByIndex<Chapter>(STORE_CHAPTERS, 'bookId', chapter.bookId);
  siblings.sort((a, b) => a.index - b.index);

  const idx = siblings.findIndex((c) => c.id === chapterId);
  const prev = idx > 0 ? (siblings[idx - 1] as Chapter) : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? (siblings[idx + 1] as Chapter) : null;

  const progress = await dbGetByIndex<ProgressRow>(STORE_PROGRESS, 'bookId', chapter.bookId);
  const completed = progress.some((p) => p.chapterId === chapterId && p.completed);

  return {
    chapter,
    prevId: prev?.id ?? null,
    nextId: next?.id ?? null,
    completed,
  };
}

export function renderChapter(data: ChapterViewData): ShellNode {
  const paragraphs = splitParagraphs(data.chapter.content);
  const body: ShellNode[] =
    paragraphs.length === 0
      ? [{ tag: 'p', className: 'chapter-view__empty', children: ['(empty chapter)'] }]
      : paragraphs.map((p) => ({
          tag: 'p',
          className: 'chapter-view__para',
          children: [p],
        }));

  const prevDisabled = data.prevId === null;
  const nextDisabled = data.nextId === null;

  return {
    tag: 'article',
    className: 'chapter-view',
    attrs: { 'data-chapter-id': data.chapter.id, 'data-book-id': data.chapter.bookId },
    children: [
      {
        tag: 'header',
        className: 'chapter-view__header',
        children: [
          { tag: 'h2', className: 'chapter-view__title', children: [data.chapter.title] },
          {
            tag: 'div',
            className: 'chapter-view__tabs',
            attrs: { role: 'tablist' },
            children: [
              {
                tag: 'button',
                className: 'chapter-view__tab chapter-view__tab--active',
                attrs: { type: 'button', 'data-mode': 'read', role: 'tab', 'aria-selected': 'true' },
                children: ['Read'],
              },
              {
                tag: 'button',
                className: 'chapter-view__tab',
                attrs: { type: 'button', 'data-mode': 'summary', role: 'tab', 'aria-selected': 'false' },
                children: ['Summary'],
              },
            ],
          },
        ],
      },
      { tag: 'div', className: 'chapter-view__body', children: body },
      {
        tag: 'div',
        className: 'chapter-view__nav',
        children: [
          {
            tag: 'button',
            className: 'chapter-view__prev',
            attrs: {
              type: 'button',
              'data-role': 'prev',
              ...(prevDisabled
                ? { disabled: 'true', 'aria-disabled': 'true' }
                : { 'data-target': data.prevId as string }),
            },
            children: ['‹ Previous'],
          },
          {
            tag: 'button',
            className: `chapter-view__mark${data.completed ? ' chapter-view__mark--done' : ''}`,
            attrs: {
              type: 'button',
              'data-role': 'mark-complete',
              'aria-pressed': data.completed ? 'true' : 'false',
            },
            children: [data.completed ? '✓ Completed' : 'Mark Complete'],
          },
          {
            tag: 'button',
            className: 'chapter-view__next',
            attrs: {
              type: 'button',
              'data-role': 'next',
              ...(nextDisabled
                ? { disabled: 'true', 'aria-disabled': 'true' }
                : { 'data-target': data.nextId as string }),
            },
            children: ['Next ›'],
          },
        ],
      },
    ],
  };
}

function progressId(bookId: string, chapterId: string): string {
  return `progress_${bookId}_${chapterId}`;
}

export async function markChapterComplete(bookId: string, chapterId: string): Promise<void> {
  const row: ProgressRow = {
    id: progressId(bookId, chapterId),
    bookId,
    chapterId,
    completed: true,
    date: todayUtc(),
  };
  await dbPut(STORE_PROGRESS, row);
}

function renderBodyParagraphs(body: HTMLElement, chapter: Chapter): void {
  const paragraphs = splitParagraphs(chapter.content);
  if (paragraphs.length === 0) {
    body.replaceChildren(
      buildElement({
        tag: 'p',
        className: 'chapter-view__empty',
        children: ['(empty chapter)'],
      }),
    );
    return;
  }
  body.replaceChildren(
    ...paragraphs.map((p) =>
      buildElement({ tag: 'p', className: 'chapter-view__para', children: [p] }),
    ),
  );
}

function switchTab(pane: HTMLElement, mode: ChapterMode): void {
  const tabs = [
    pane.querySelector('.chapter-view__tab[data-mode="read"]') as HTMLElement | null,
    pane.querySelector('.chapter-view__tab[data-mode="summary"]') as HTMLElement | null,
  ];
  for (const t of tabs) {
    if (t === null) continue;
    const isActive = t.getAttribute('data-mode') === mode;
    t.classList.remove('chapter-view__tab--active');
    if (isActive) t.classList.add('chapter-view__tab--active');
    t.setAttribute('aria-selected', isActive ? 'true' : 'false');
  }
}

function wireChapterView(pane: HTMLElement, data: ChapterViewData, toastContainer: HTMLElement): void {
  const prev = pane.querySelector('.chapter-view__prev') as HTMLElement | null;
  const next = pane.querySelector('.chapter-view__next') as HTMLElement | null;
  const mark = pane.querySelector('.chapter-view__mark') as HTMLElement | null;
  const body = pane.querySelector('.chapter-view__body') as HTMLElement | null;
  const readTab = pane.querySelector('.chapter-view__tab[data-mode="read"]') as HTMLElement | null;
  const summaryTab = pane.querySelector('.chapter-view__tab[data-mode="summary"]') as HTMLElement | null;

  prev?.addEventListener('click', () => {
    if (data.prevId === null || navigateHandler === null) return;
    navigateHandler(data.chapter.bookId, data.prevId);
  });
  next?.addEventListener('click', () => {
    if (data.nextId === null || navigateHandler === null) return;
    navigateHandler(data.chapter.bookId, data.nextId);
  });
  mark?.addEventListener('click', () => {
    void markChapterComplete(data.chapter.bookId, data.chapter.id).then(
      () => {
        // Flip in place — no layout shift. Just change text + state.
        mark.classList.add('chapter-view__mark--done');
        mark.setAttribute('aria-pressed', 'true');
        mark.textContent = '✓ Completed';
        data.completed = true;
      },
      (err: Error) => {
        showToast(toastContainer, `Mark complete failed: ${err.message}`, 'error');
      },
    );
  });

  // Tab toggle: swap body content between paragraph render and summary view.
  readTab?.addEventListener('click', () => {
    if (body === null) return;
    switchTab(pane, 'read');
    renderBodyParagraphs(body, data.chapter);
  });
  summaryTab?.addEventListener('click', () => {
    if (body === null) return;
    switchTab(pane, 'summary');
    void showSummary(data.chapter, body, {
      toastContainer,
      onAfterLoad: async () => {
        if (summaryWritebackHandler !== null) await summaryWritebackHandler();
      },
    });
  });
}

export async function showChapter(
  chapterId: string,
  pane: HTMLElement,
  toastContainer: HTMLElement,
): Promise<boolean> {
  const data = await loadChapterView(chapterId);
  if (data === null) {
    pane.replaceChildren();
    showToast(toastContainer, 'Chapter not found.', 'error');
    return false;
  }
  pane.replaceChildren(buildElement(renderChapter(data)));
  wireChapterView(pane, data, toastContainer);
  return true;
}

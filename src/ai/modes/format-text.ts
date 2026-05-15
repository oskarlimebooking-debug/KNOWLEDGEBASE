// Format Text mode (Sprint B / TB.10).
//
// Re-render a chapter's plain text as semantic HTML (`<h2>`, `<p>`,
// `<ul>`, `<strong>`, `<blockquote>`) via Claude. Result is sanitised
// through TB.9's `sanitizeHtml` BEFORE storage — the audit-blessed
// boundary that lets the chapter view safely `innerHTML` it back.
//
// Storage model: written to `chapter.formattedHtml` on the chapter row
// (the chapter view reads it from there). NOT in the `generated` cache
// store — formattedHtml is "user content", not regenerable cache.

import { dbPut } from '../../data/db';
import { STORE_CHAPTERS } from '../../data/schema';
import type { Chapter } from '../../lib/importers/types';
import { sanitizeHtml } from '../../lib/markdown';
import { callAnthropic } from '../anthropic';
import { getPrompt } from '../prompts';

const MAX_OUTPUT_TOKENS = 4_000;

function fillPrompt(template: string, chapter: Chapter): string {
  return template.replace(/\{title\}/g, chapter.title).replace(/\{content\}/g, chapter.content);
}

/** Generate sanitised HTML for one chapter and persist it. */
export async function formatChapter(
  chapter: Chapter,
  apiKey: string,
  model?: string,
): Promise<string> {
  if (apiKey === '') throw new Error('API key not set');
  const template = await getPrompt('formatText');
  const prompt = fillPrompt(template, chapter);
  const raw = await callAnthropic(prompt, apiKey, model, {
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    // The model returns HTML directly; structured-outputs JSON mode would
    // require wrapping the HTML in JSON. Prompt template instructs the
    // model to emit only HTML (no markdown fences, no preamble).
  });
  const sanitised = sanitizeHtml(raw);
  await dbPut(STORE_CHAPTERS, { ...chapter, formattedHtml: sanitised });
  return sanitised;
}

export interface FormatAllProgress {
  /** Index of the chapter currently being processed (0-based). */
  currentIndex: number;
  /** Total chapter count for the run. */
  total: number;
  /** ID of the chapter that just completed (undefined while a chapter is
   *  in flight). */
  completedChapterId?: string;
  /** Error from the most recent chapter, or null on success / not yet
   *  attempted. The run continues on per-chapter failures. */
  error: Error | null;
}

/** Format every chapter sequentially. `onProgress` is invoked after each
 *  chapter completes (or fails). Failures don't stop the run — the next
 *  chapter is attempted. Returns the IDs of chapters that errored. */
export async function formatAllChapters(
  chapters: ReadonlyArray<Chapter>,
  apiKey: string,
  onProgress: (p: FormatAllProgress) => void,
  model?: string,
): Promise<{ errored: string[] }> {
  const errored: string[] = [];
  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i] as Chapter;
    try {
      await formatChapter(c, apiKey, model);
      onProgress({
        currentIndex: i,
        total: chapters.length,
        completedChapterId: c.id,
        error: null,
      });
    } catch (err) {
      errored.push(c.id);
      onProgress({
        currentIndex: i,
        total: chapters.length,
        completedChapterId: c.id,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }
  return { errored };
}

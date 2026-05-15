// Generation cache (Sprint B / TB.4).
//
// The canonical cache wrapper every Phase-B reading mode reuses. Wraps a
// generator function with read-through caching on the `generated` IDB
// store, keyed by `<type>_<chapterId>`. On miss it calls the generator,
// stores the result, and returns it. On hit it returns the cached value
// without calling the generator at all.
//
// CACHE KEY SHAPE — LOCKED.
//   `${type}_${chapter.id}`
// Drive sync (Phase F) depends on this exact shape. Renaming any of the
// six type tokens (summary / quiz / flashcards / teachback / formatText
// / chapterSplit) silently re-keys every cached artefact in IDB AND
// breaks every synced device.  DO NOT RENAME LATER — see the Sprint-B
// G-Manual gate.
//
// USAGE PATTERN (the shape TB.5–TB.8 follow):
//
//   ```ts
//   // src/ai/modes/summary.ts
//   import { withGenerationCache } from '../../lib/cache';
//   import { callAnthropic } from '../anthropic';
//
//   async function generateSummary(chapter: Chapter): Promise<Summary> {
//     const raw = await callAnthropic(
//       fillPrompt('summary', chapter),
//       apiKey,
//       undefined,
//       { jsonSchema: SUMMARY_SCHEMA },
//     );
//     return JSON.parse(raw) as Summary;
//   }
//
//   export const loadSummary = withGenerationCache('summary', generateSummary);
//
//   // somewhere in the chapter view:
//   try {
//     const summary = await loadSummary(chapter);
//     renderSummary(summary);
//   } catch (err) {
//     renderErrorState(err);  // TB.12: retry button reruns loadSummary
//   }
//   ```
//
// Cache-miss observability: in dev (`import.meta.env.DEV`) the wrapper
// logs `[gen cache] hit <key>` / `miss <key>` to `console.debug`. In
// prod the wrapper is silent (no console noise, AC #3 from TB.3 also
// applies — silent fallback is the contract throughout the cache layer).

import { dbDelete, dbGet, dbPut } from '../data/db';
import { STORE_GENERATED } from '../data/schema';
import type { Chapter } from './importers/types';

export type GenerationType =
  | 'summary'
  | 'quiz'
  | 'flashcards'
  | 'teachback'
  | 'formatText'
  | 'chapterSplit';

export const GENERATION_TYPES: ReadonlyArray<GenerationType> = Object.freeze([
  'summary',
  'quiz',
  'flashcards',
  'teachback',
  'formatText',
  'chapterSplit',
]);

export interface GeneratedRow<T = unknown> {
  id: string;
  chapterId: string;
  type: GenerationType;
  content: T;
  createdAt: string;
}

export type GenerationGenerator<T> = (chapter: Chapter) => Promise<T>;
export type GenerationLoader<T> = (chapter: Chapter) => Promise<T>;

export function generationKey(type: GenerationType, chapterId: string): string {
  return `${type}_${chapterId}`;
}

function logDev(message: string): void {
  // Vite injects `import.meta.env.DEV` at build time. Guard for SSR / tests
  // where import.meta.env may be undefined.
  const env = (import.meta as { env?: { DEV?: boolean } }).env;
  if (env !== undefined && env.DEV === true) {
    // eslint-disable-next-line no-console
    console.debug(message);
  }
}

export function withGenerationCache<T>(
  type: GenerationType,
  fn: GenerationGenerator<T>,
): GenerationLoader<T> {
  return async (chapter: Chapter): Promise<T> => {
    const id = generationKey(type, chapter.id);
    const row = await dbGet<GeneratedRow<T>>(STORE_GENERATED, id);
    if (row !== undefined) {
      logDev(`[gen cache] hit ${id}`);
      return row.content;
    }
    logDev(`[gen cache] miss ${id}`);
    const content = await fn(chapter);
    const toStore: GeneratedRow<T> = {
      id,
      chapterId: chapter.id,
      type,
      content,
      createdAt: new Date().toISOString(),
    };
    await dbPut(STORE_GENERATED, toStore);
    return content;
  };
}

// Used by TB.6's "Regenerate" affordance and by any flow that needs to
// blow away a stale artefact before re-running its generator.
export async function invalidateGeneration(
  type: GenerationType,
  chapterId: string,
): Promise<void> {
  await dbDelete(STORE_GENERATED, generationKey(type, chapterId));
}

// Read-only inspection — useful for "has this chapter been summarised
// yet" badges in the library/book views without forcing a generation.
export async function getCachedGeneration<T>(
  type: GenerationType,
  chapterId: string,
): Promise<T | undefined> {
  const row = await dbGet<GeneratedRow<T>>(STORE_GENERATED, generationKey(type, chapterId));
  return row?.content;
}

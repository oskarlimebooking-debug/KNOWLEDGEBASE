// Teach-Back mode (Sprint B / TB.8).
//
// `evaluateTeachback(chapter, explanation, apiKey, model?)` asks Claude to
// score the learner's free-form explanation of a chapter and return
// structured feedback `{strengths, gaps, suggestions, score}`. The
// attempt — both the user's explanation and the evaluator result — is
// cached under the locked TB.4 key `teachback_<chapterId>` so the next
// open of this chapter's Teach-Back tab can render the last attempt
// without a round-trip (AC #3).
//
// Unlike the other modes, the cache value is NOT just the generator
// output: it stores `{explanation, result}` together so the textarea
// can be seeded with whatever the user wrote last time and the result
// panel can show the matching feedback. `withGenerationCache` from the
// shared cache layer assumes a chapter-only generator, so this module
// writes the row directly via `dbPut` (same pattern as flashcards'
// `appendFlashcards`).
//
// AC checklist (backlog):
//   #1 Useful feedback — locked into the prompt + schema (strengths,
//      gaps, suggestions, score).  Manual A/B vs. a stub is verified at
//      reviewer-time, not in unit tests.
//   #2 Score badge color — owned by the view layer; this module just
//      returns the numeric 0-100 score.
//   #3 Cache lets user revisit last attempt — `loadCachedTeachback`
//      reads the stored `{explanation, result}` without an API call.
//   #4 Empty input shows inline validation — the view layer guards
//      submit on empty input; this module's belt-and-braces guard
//      throws on empty/whitespace explanation as defence in depth.

import { dbPut } from '../../data/db';
import { STORE_GENERATED } from '../../data/schema';
import {
  generationKey,
  getCachedGeneration,
  type GeneratedRow,
} from '../../lib/cache';
import type { Chapter } from '../../lib/importers/types';
import { callAnthropic } from '../anthropic';
import { getPrompt } from '../prompts';

export interface TeachbackResult {
  strengths: string[];
  gaps: string[];
  suggestions: string[];
  score: number;
}

export interface TeachbackAttempt {
  explanation: string;
  result: TeachbackResult;
}

const MAX_OUTPUT_TOKENS = 2_000;

const TEACHBACK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['strengths', 'gaps', 'suggestions', 'score'],
  properties: {
    strengths: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'string' } },
    gaps: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'string' } },
    suggestions: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'string' } },
    score: { type: 'integer', minimum: 0, maximum: 100 },
  },
} as const;

function fillPrompt(template: string, chapter: Chapter, explanation: string): string {
  return template
    .replace(/\{title\}/g, chapter.title)
    .replace(/\{content\}/g, chapter.content)
    .replace(/\{explanation\}/g, explanation);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === 'string');
}

function isTeachbackResult(v: unknown): v is TeachbackResult {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (!isStringArray(o.strengths)) return false;
  if (!isStringArray(o.gaps)) return false;
  if (!isStringArray(o.suggestions)) return false;
  if (typeof o.score !== 'number' || !Number.isInteger(o.score)) return false;
  if (o.score < 0 || o.score > 100) return false;
  return true;
}

export async function evaluateTeachback(
  chapter: Chapter,
  explanation: string,
  apiKey: string,
  model?: string,
): Promise<TeachbackResult> {
  if (apiKey === '') throw new Error('API key not set');
  if (explanation.trim() === '') throw new Error('Explanation must not be empty');

  const template = await getPrompt('teachback');
  const prompt = fillPrompt(template, chapter, explanation);
  const raw = await callAnthropic(prompt, apiKey, model, {
    jsonSchema: TEACHBACK_SCHEMA as unknown as Record<string, unknown>,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Teach-back response was not valid JSON');
  }
  if (!isTeachbackResult(parsed)) {
    throw new Error('Teach-back response did not match the expected shape');
  }

  const attempt: TeachbackAttempt = { explanation, result: parsed };
  const row: GeneratedRow<TeachbackAttempt> = {
    id: generationKey('teachback', chapter.id),
    chapterId: chapter.id,
    type: 'teachback',
    content: attempt,
    createdAt: new Date().toISOString(),
  };
  await dbPut(STORE_GENERATED, row);

  return parsed;
}

export async function loadCachedTeachback(
  chapterId: string,
): Promise<TeachbackAttempt | undefined> {
  return getCachedGeneration<TeachbackAttempt>('teachback', chapterId);
}

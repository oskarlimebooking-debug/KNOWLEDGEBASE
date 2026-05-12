// Flashcards mode (Sprint B / TB.7).
//
// `loadFlashcards(chapter, apiKey, model?)` returns 5+ cards `{front, back}`
// for a chapter, cached under the locked TB.4 key `flashcards_<chapterId>`.
// `appendFlashcards` powers the "More cards" affordance: it reads the
// cached set, asks Claude for more cards while instructing exclusion of
// existing fronts, then merges (dedupe by front, case-insensitive +
// whitespace-trimmed) and writes the merged set back under the same key.
//
// AC checklist (backlog):
//   #1 ≥ 5 cards on initial generation — enforced post-parse in
//      `generateFlashcardsRaw`.
//   #2 60fps flip — owned by the view layer (CSS transform / 3D flip).
//   #3 More cards appends without duplicating fronts — owned by
//      `mergeUniqueByFront` here and verified by the test suite.
//   #4 Cache key `flashcards_<chapterId>` — `withGenerationCache` and the
//      explicit writeback in `appendFlashcards` both honour this.

import { dbPut } from '../../data/db';
import { STORE_GENERATED } from '../../data/schema';
import {
  generationKey,
  getCachedGeneration,
  withGenerationCache,
  type GeneratedRow,
  type GenerationGenerator,
} from '../../lib/cache';
import type { Chapter } from '../../lib/importers/types';
import { callAnthropic } from '../anthropic';
import { getPrompt } from '../prompts';

export interface Flashcard {
  front: string;
  back: string;
}

const MIN_INITIAL_CARDS = 5;
const MAX_OUTPUT_TOKENS = 4_000;

const FLASHCARDS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['cards'],
  properties: {
    cards: {
      type: 'array',
      minItems: 1,
      maxItems: 12,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['front', 'back'],
        properties: {
          front: { type: 'string', minLength: 1 },
          back: { type: 'string', minLength: 1 },
        },
      },
    },
  },
} as const;

function fillPrompt(template: string, chapter: Chapter): string {
  return template.replace(/\{title\}/g, chapter.title).replace(/\{content\}/g, chapter.content);
}

function isFlashcardArray(v: unknown): v is Flashcard[] {
  if (!Array.isArray(v)) return false;
  return v.every(
    (c) =>
      typeof c === 'object' &&
      c !== null &&
      typeof (c as Flashcard).front === 'string' &&
      typeof (c as Flashcard).back === 'string',
  );
}

async function callForCards(
  prompt: string,
  apiKey: string,
  model?: string,
): Promise<Flashcard[]> {
  if (apiKey === '') throw new Error('API key not set');
  const raw = await callAnthropic(prompt, apiKey, model, {
    jsonSchema: FLASHCARDS_SCHEMA as unknown as Record<string, unknown>,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  });
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Flashcards response was not valid JSON');
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !isFlashcardArray((parsed as { cards?: unknown }).cards)
  ) {
    throw new Error('Flashcards response did not match the expected shape');
  }
  return (parsed as { cards: Flashcard[] }).cards;
}

export async function generateFlashcardsRaw(
  chapter: Chapter,
  apiKey: string,
  model?: string,
): Promise<Flashcard[]> {
  const template = await getPrompt('flashcards');
  const prompt = fillPrompt(template, chapter);
  const cards = await callForCards(prompt, apiKey, model);
  if (cards.length < MIN_INITIAL_CARDS) {
    throw new Error(
      `Flashcards generation returned ${cards.length} cards, expected at least ${MIN_INITIAL_CARDS}`,
    );
  }
  return cards;
}

function flashcardsGeneratorFor(
  apiKey: string,
  model?: string,
): GenerationGenerator<Flashcard[]> {
  return (chapter: Chapter) => generateFlashcardsRaw(chapter, apiKey, model);
}

export async function loadFlashcards(
  chapter: Chapter,
  apiKey: string,
  model?: string,
): Promise<Flashcard[]> {
  return withGenerationCache('flashcards', flashcardsGeneratorFor(apiKey, model))(chapter);
}

function normalizeFront(front: string): string {
  return front.trim().toLowerCase();
}

function mergeUniqueByFront(existing: Flashcard[], additions: Flashcard[]): Flashcard[] {
  const seen = new Set(existing.map((c) => normalizeFront(c.front)));
  const out = [...existing];
  for (const c of additions) {
    const key = normalizeFront(c.front);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

async function generateMoreFlashcardsRaw(
  chapter: Chapter,
  existingFronts: ReadonlyArray<string>,
  apiKey: string,
  model?: string,
): Promise<Flashcard[]> {
  const base = fillPrompt(await getPrompt('flashcards'), chapter);
  const exclusion =
    existingFronts.length === 0
      ? ''
      : `\n\nDo NOT duplicate any of these existing flashcard fronts:\n${existingFronts
          .map((f) => `- ${f}`)
          .join('\n')}`;
  return callForCards(base + exclusion, apiKey, model);
}

export async function appendFlashcards(
  chapter: Chapter,
  apiKey: string,
  model?: string,
): Promise<Flashcard[]> {
  const existing = await getCachedGeneration<Flashcard[]>('flashcards', chapter.id);
  if (existing === undefined) {
    return loadFlashcards(chapter, apiKey, model);
  }
  const additions = await generateMoreFlashcardsRaw(
    chapter,
    existing.map((c) => c.front),
    apiKey,
    model,
  );
  const merged = mergeUniqueByFront(existing, additions);
  const row: GeneratedRow<Flashcard[]> = {
    id: generationKey('flashcards', chapter.id),
    chapterId: chapter.id,
    type: 'flashcards',
    content: merged,
    createdAt: new Date().toISOString(),
  };
  await dbPut(STORE_GENERATED, row);
  return merged;
}

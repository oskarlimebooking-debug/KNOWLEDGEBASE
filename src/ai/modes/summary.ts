// Summary mode (Sprint B / TB.5).
//
// `loadSummary(chapter, apiKey, model?)` adopts the TB.4 cache pattern:
//   * Cache key: `summary_<chapterId>`  (locked, G-Manual gate)
//   * On miss: calls `generateSummaryRaw` → `callAnthropic` with strict
//     `output_config.format` (json_schema). Parsed result is cached;
//     `chapter.difficulty` is written back to the chapter row so the
//     library card can show difficulty stars (TB.5 AC #2).
//   * On hit: returns the cached `Summary` instantly (AC #1).
//
// Errors propagate up; the UI layer (`src/ui/summary-view.ts`) renders
// an empty state with a Retry button (AC #3).

import { dbPut } from '../../data/db';
import { STORE_CHAPTERS } from '../../data/schema';
import {
  withGenerationCache,
  type GenerationGenerator,
} from '../../lib/cache';
import type { Chapter } from '../../lib/importers/types';
import { callAnthropic } from '../anthropic';
import { getPrompt } from '../prompts';

export interface Summary {
  keyConcepts: string[];
  summary: string;
  difficulty: number;
  readingTime: number;
}

const SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['keyConcepts', 'summary', 'difficulty', 'readingTime'],
  properties: {
    keyConcepts: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: { type: 'string' },
    },
    summary: { type: 'string' },
    difficulty: { type: 'integer', minimum: 1, maximum: 5 },
    readingTime: { type: 'integer', minimum: 1 },
  },
} as const;

const MAX_OUTPUT_TOKENS = 2_000;

function fillPrompt(template: string, chapter: Chapter): string {
  return template.replace(/\{title\}/g, chapter.title).replace(/\{content\}/g, chapter.content);
}

function isSummary(v: unknown): v is Summary {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    Array.isArray(o.keyConcepts) &&
    o.keyConcepts.every((s) => typeof s === 'string') &&
    typeof o.summary === 'string' &&
    typeof o.difficulty === 'number' &&
    typeof o.readingTime === 'number'
  );
}

export async function generateSummaryRaw(
  chapter: Chapter,
  apiKey: string,
  model?: string,
): Promise<Summary> {
  if (apiKey === '') throw new Error('API key not set');
  const template = await getPrompt('summary');
  const prompt = fillPrompt(template, chapter);
  const raw = await callAnthropic(prompt, apiKey, model, {
    jsonSchema: SUMMARY_SCHEMA as unknown as Record<string, unknown>,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  });
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Summary response was not valid JSON');
  }
  if (!isSummary(parsed)) throw new Error('Summary response did not match the expected shape');
  // Write back difficulty onto the chapter row so the library card can show
  // it. The chapter row is overwritten in full — `dbPut` is upsert, so we
  // merge by spreading the original chapter then assigning difficulty.
  await dbPut(STORE_CHAPTERS, { ...chapter, difficulty: parsed.difficulty });
  return parsed;
}

function summaryGeneratorFor(apiKey: string, model?: string): GenerationGenerator<Summary> {
  return (chapter: Chapter) => generateSummaryRaw(chapter, apiKey, model);
}

export async function loadSummary(
  chapter: Chapter,
  apiKey: string,
  model?: string,
): Promise<Summary> {
  return withGenerationCache('summary', summaryGeneratorFor(apiKey, model))(chapter);
}

// Classic Quiz mode (Sprint B / TB.6).
//
// Adopts the TB.4 cache pattern: `loadQuiz` via `withGenerationCache('quiz', ...)`.
// Quiz content cache:  `quiz_<chapterId>` → `Quiz` (the 5-question payload).
// Attempt history:     `quiz_scores_<chapterId>` (settings store; see
//                      src/lib/quiz-scores.ts).
//
// The provider has three operations the UI calls:
//   * loadQuiz                — first open or cache-hit; never re-fetches.
//   * appendMoreQuestions     — "Generate More Questions" path — appends
//                               new questions to the existing quiz with
//                               an explicit "do not repeat these prompts"
//                               instruction; the merged quiz overwrites
//                               the cache row.
//   * regenerateQuiz          — "Regenerate" — invalidates the cache row
//                               then re-loads from scratch.

import { dbPut } from '../../data/db';
import { STORE_GENERATED } from '../../data/schema';
import {
  generationKey,
  invalidateGeneration,
  withGenerationCache,
  type GeneratedRow,
} from '../../lib/cache';
import type { Chapter } from '../../lib/importers/types';
import { callAnthropic } from '../anthropic';
import { getPrompt } from '../prompts';

export type QuizQuestion =
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | OpenEndedQuestion;

export interface MultipleChoiceQuestion {
  type: 'multiple_choice';
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface TrueFalseQuestion {
  type: 'true_false';
  prompt: string;
  correct: boolean;
  explanation: string;
}

export interface OpenEndedQuestion {
  type: 'open_ended';
  prompt: string;
  sampleAnswer: string;
}

export interface Quiz {
  questions: QuizQuestion[];
}

// Answer types as recorded by the UI when the user progresses through
// a quiz attempt. `correct` is `null` for open-ended (self-assessed).
export type QuizAnswer =
  | { questionIndex: number; type: 'multiple_choice'; selectedIndex: number; correct: boolean }
  | { questionIndex: number; type: 'true_false'; selected: boolean; correct: boolean }
  | { questionIndex: number; type: 'open_ended'; text: string; correct: null };

const QUIZ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      minItems: 1,
      items: {
        oneOf: [
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'prompt', 'options', 'correctIndex', 'explanation'],
            properties: {
              type: { const: 'multiple_choice' },
              prompt: { type: 'string' },
              options: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 },
              correctIndex: { type: 'integer', minimum: 0, maximum: 3 },
              explanation: { type: 'string' },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'prompt', 'correct', 'explanation'],
            properties: {
              type: { const: 'true_false' },
              prompt: { type: 'string' },
              correct: { type: 'boolean' },
              explanation: { type: 'string' },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'prompt', 'sampleAnswer'],
            properties: {
              type: { const: 'open_ended' },
              prompt: { type: 'string' },
              sampleAnswer: { type: 'string' },
            },
          },
        ],
      },
    },
  },
} as const;

const MAX_OUTPUT_TOKENS = 4_000;

function fillPrompt(template: string, chapter: Chapter, extraInstruction = ''): string {
  let p = template.replace(/\{title\}/g, chapter.title).replace(/\{content\}/g, chapter.content);
  if (extraInstruction !== '') p = `${p}\n\n${extraInstruction}`;
  return p;
}

function isQuiz(v: unknown): v is Quiz {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.questions)) return false;
  return o.questions.every(isQuestion);
}

function isQuestion(q: unknown): q is QuizQuestion {
  if (typeof q !== 'object' || q === null) return false;
  const o = q as Record<string, unknown>;
  if (typeof o.prompt !== 'string') return false;
  switch (o.type) {
    case 'multiple_choice':
      return (
        Array.isArray(o.options) &&
        o.options.every((s) => typeof s === 'string') &&
        typeof o.correctIndex === 'number' &&
        typeof o.explanation === 'string'
      );
    case 'true_false':
      return typeof o.correct === 'boolean' && typeof o.explanation === 'string';
    case 'open_ended':
      return typeof o.sampleAnswer === 'string';
    default:
      return false;
  }
}

export async function generateQuizRaw(
  chapter: Chapter,
  apiKey: string,
  options: { excludeQuestions?: ReadonlyArray<string>; model?: string } = {},
): Promise<Quiz> {
  if (apiKey === '') throw new Error('API key not set');
  const template = await getPrompt('quiz');
  const exclude =
    options.excludeQuestions !== undefined && options.excludeQuestions.length > 0
      ? `Do NOT repeat any of these question prompts (the user has already seen them):\n${options.excludeQuestions.map((q) => `- ${q}`).join('\n')}`
      : '';
  const prompt = fillPrompt(template, chapter, exclude);
  const raw = await callAnthropic(prompt, apiKey, options.model, {
    jsonSchema: QUIZ_SCHEMA as unknown as Record<string, unknown>,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  });
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Quiz response was not valid JSON');
  }
  if (!isQuiz(parsed)) throw new Error('Quiz response did not match the expected shape');
  return parsed;
}

export async function loadQuiz(chapter: Chapter, apiKey: string, model?: string): Promise<Quiz> {
  return withGenerationCache('quiz', (c) =>
    generateQuizRaw(c, apiKey, model !== undefined ? { model } : {}),
  )(chapter);
}

export async function appendMoreQuestions(
  chapter: Chapter,
  apiKey: string,
  currentQuiz: Quiz,
  model?: string,
): Promise<Quiz> {
  const exclude = currentQuiz.questions.map((q) => q.prompt);
  const fresh = await generateQuizRaw(chapter, apiKey, {
    excludeQuestions: exclude,
    ...(model !== undefined ? { model } : {}),
  });
  const merged: Quiz = { questions: [...currentQuiz.questions, ...fresh.questions] };
  // Overwrite the cache row with the merged quiz so the next load picks
  // up the appended questions instantly.
  const row: GeneratedRow<Quiz> = {
    id: generationKey('quiz', chapter.id),
    chapterId: chapter.id,
    type: 'quiz',
    content: merged,
    createdAt: new Date().toISOString(),
  };
  await dbPut(STORE_GENERATED, row);
  return merged;
}

export async function regenerateQuiz(
  chapter: Chapter,
  apiKey: string,
  model?: string,
): Promise<Quiz> {
  await invalidateGeneration('quiz', chapter.id);
  return loadQuiz(chapter, apiKey, model);
}

// --- pure grading helper --------------------------------------------------

export interface QuizScore {
  /** 0-100, rounded. Computed across MC + T/F questions only; open-ended
   *  is shown for self-reflection and is not counted toward the score. */
  percent: number;
  correctCount: number;
  gradedCount: number;
  wrongIndices: number[];
}

export function gradeQuiz(quiz: Quiz, answers: ReadonlyArray<QuizAnswer>): QuizScore {
  const wrongIndices: number[] = [];
  let correctCount = 0;
  let gradedCount = 0;
  for (const ans of answers) {
    const q = quiz.questions[ans.questionIndex];
    if (q === undefined) continue;
    if (q.type === 'open_ended') continue; // not graded
    gradedCount++;
    if (ans.correct === true) correctCount++;
    else wrongIndices.push(ans.questionIndex);
  }
  const percent = gradedCount === 0 ? 0 : Math.round((correctCount / gradedCount) * 100);
  return { percent, correctCount, gradedCount, wrongIndices };
}

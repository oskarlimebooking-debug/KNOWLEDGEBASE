import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import {
  appendMoreQuestions,
  generateQuizRaw,
  gradeQuiz,
  loadQuiz,
  regenerateQuiz,
  type Quiz,
  type QuizAnswer,
} from './quiz';
import { closeDb, dbGet, dbPut, setSetting } from '../../data/db';
import { STORE_CHAPTERS, STORE_GENERATED } from '../../data/schema';
import type { Chapter } from '../../lib/importers/types';
import type { GeneratedRow } from '../../lib/cache';

const API_KEY = 'sk-ant-test-abc123';

function chapter(): Chapter {
  return {
    id: 'book_1_ch_0',
    bookId: 'book_1',
    index: 0,
    title: 'Forces of Nature',
    content: 'Some body text.',
  };
}

const VALID_QUIZ: Quiz = {
  questions: [
    {
      type: 'multiple_choice',
      prompt: 'What is gravity?',
      options: ['A force', 'A particle', 'A wave', 'A field'],
      correctIndex: 0,
      explanation: 'Gravity is a fundamental force.',
    },
    {
      type: 'multiple_choice',
      prompt: 'Newton wrote which book?',
      options: ['Principia', 'Origin of Species', 'Cosmos', 'A Brief History'],
      correctIndex: 0,
      explanation: 'Newton wrote Principia Mathematica.',
    },
    {
      type: 'multiple_choice',
      prompt: 'Speed of light is approximately?',
      options: ['300k km/s', '300 m/s', '3000 km/s', '30 km/s'],
      correctIndex: 0,
      explanation: 'c ≈ 3×10^8 m/s.',
    },
    {
      type: 'true_false',
      prompt: 'Energy can be created from nothing.',
      correct: false,
      explanation: 'Energy is conserved.',
    },
    {
      type: 'open_ended',
      prompt: 'Explain conservation of momentum.',
      sampleAnswer: 'In a closed system, total momentum is constant.',
    },
  ],
};

function anthropicResponse(payload: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({
      id: 'msg_x',
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-4-7',
      content: [{ type: 'text', text: JSON.stringify(payload) }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  vi.restoreAllMocks();
});

afterEach(async () => {
  await closeDb();
  vi.restoreAllMocks();
});

describe('generateQuizRaw', () => {
  it('throws when API key is empty', async () => {
    await expect(generateQuizRaw(chapter(), '')).rejects.toThrow(/API key/i);
  });

  it('returns the parsed quiz from the API response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse(VALID_QUIZ));
    expect(await generateQuizRaw(chapter(), API_KEY)).toEqual(VALID_QUIZ);
  });

  it('rejects malformed JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'msg_x',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-4-7',
          content: [{ type: 'text', text: 'not json' }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    await expect(generateQuizRaw(chapter(), API_KEY)).rejects.toThrow(/JSON/i);
  });

  it('rejects responses with no questions array', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse({ wrong: 'shape' }));
    await expect(generateQuizRaw(chapter(), API_KEY)).rejects.toThrow(/shape/i);
  });

  it('rejects question objects with unknown types', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      anthropicResponse({ questions: [{ type: 'mystery', prompt: 'huh?' }] }),
    );
    await expect(generateQuizRaw(chapter(), API_KEY)).rejects.toThrow(/shape/i);
  });

  it('includes a do-not-repeat instruction when excludeQuestions is provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse(VALID_QUIZ));
    await generateQuizRaw(chapter(), API_KEY, {
      excludeQuestions: ['What is gravity?', 'Newton wrote which book?'],
    });
    const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string) as {
      messages: { content: string }[];
    };
    expect(body.messages[0]!.content).toMatch(/Do NOT repeat/i);
    expect(body.messages[0]!.content).toContain('What is gravity?');
    expect(body.messages[0]!.content).toContain('Newton wrote which book?');
  });

  it('sends jsonSchema enforcement on the request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse(VALID_QUIZ));
    await generateQuizRaw(chapter(), API_KEY);
    const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string) as {
      output_config?: { format?: { type?: string } };
    };
    expect(body.output_config?.format?.type).toBe('json_schema');
  });
});

describe('loadQuiz — TB.4 cache adoption', () => {
  it('caches the quiz and short-circuits the second load (instant)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse(VALID_QUIZ));
    await dbPut(STORE_CHAPTERS, chapter());
    expect(await loadQuiz(chapter(), API_KEY)).toEqual(VALID_QUIZ);
    expect(await loadQuiz(chapter(), API_KEY)).toEqual(VALID_QUIZ);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('writes the row under the locked `quiz_<chapterId>` key', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse(VALID_QUIZ));
    await loadQuiz(chapter(), API_KEY);
    const row = await dbGet<GeneratedRow<Quiz>>(STORE_GENERATED, 'quiz_book_1_ch_0');
    expect(row?.type).toBe('quiz');
    expect(row?.content.questions).toHaveLength(5);
  });
});

describe('regenerateQuiz', () => {
  it('invalidates the existing cache row and refetches', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(anthropicResponse(VALID_QUIZ))
      .mockResolvedValueOnce(
        anthropicResponse({
          questions: [
            {
              type: 'true_false',
              prompt: 'Fresh question.',
              correct: true,
              explanation: 'yes',
            },
          ],
        } satisfies Quiz),
      );
    await loadQuiz(chapter(), API_KEY); // first generation
    const fresh = await regenerateQuiz(chapter(), API_KEY); // forces a re-fetch
    expect(fresh.questions[0]!.prompt).toBe('Fresh question.');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe('appendMoreQuestions', () => {
  it('appends and overwrites the cache; does not duplicate existing prompts', async () => {
    const more: Quiz = {
      questions: [
        {
          type: 'true_false',
          prompt: 'Yet another question.',
          correct: true,
          explanation: 'sure',
        },
      ],
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse(more));
    const merged = await appendMoreQuestions(chapter(), API_KEY, VALID_QUIZ);
    expect(merged.questions).toHaveLength(VALID_QUIZ.questions.length + 1);
    expect(merged.questions[merged.questions.length - 1]!.prompt).toBe('Yet another question.');

    // The do-not-repeat instruction must include every existing prompt.
    const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string) as {
      messages: { content: string }[];
    };
    for (const q of VALID_QUIZ.questions) {
      expect(body.messages[0]!.content).toContain(q.prompt);
    }

    // Cache row was updated.
    const row = await dbGet<GeneratedRow<Quiz>>(STORE_GENERATED, 'quiz_book_1_ch_0');
    expect(row?.content.questions).toHaveLength(merged.questions.length);
  });
});

describe('gradeQuiz', () => {
  it('grades MC + T/F correctly and excludes open-ended from the score', () => {
    const answers: QuizAnswer[] = [
      { questionIndex: 0, type: 'multiple_choice', selectedIndex: 0, correct: true },
      { questionIndex: 1, type: 'multiple_choice', selectedIndex: 1, correct: false },
      { questionIndex: 2, type: 'multiple_choice', selectedIndex: 0, correct: true },
      { questionIndex: 3, type: 'true_false', selected: false, correct: true },
      { questionIndex: 4, type: 'open_ended', text: 'My answer', correct: null },
    ];
    const score = gradeQuiz(VALID_QUIZ, answers);
    expect(score.gradedCount).toBe(4); // open-ended excluded
    expect(score.correctCount).toBe(3);
    expect(score.percent).toBe(75); // 3/4
    expect(score.wrongIndices).toEqual([1]);
  });

  it('returns 0 percent when nothing graded', () => {
    expect(gradeQuiz(VALID_QUIZ, [])).toEqual({
      percent: 0,
      correctCount: 0,
      gradedCount: 0,
      wrongIndices: [],
    });
  });
});

describe('prompt template substitution', () => {
  it('substitutes {title} / {content} into the quiz prompt template', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse(VALID_QUIZ));
    await setSetting('prompt_quiz', 'BOOK={title} TEXT={content}');
    await generateQuizRaw(chapter(), API_KEY);
    const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string) as {
      messages: { content: string }[];
    };
    expect(body.messages[0]!.content).toContain('BOOK=Forces of Nature');
    expect(body.messages[0]!.content).toContain('TEXT=Some body text.');
  });
});

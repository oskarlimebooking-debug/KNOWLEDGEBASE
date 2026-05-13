import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import {
  getQuizAttempts,
  quizScoresKey,
  quizStats,
  recordQuizAttempt,
  type QuizAttempt,
} from './quiz-scores';
import { closeDb, getSetting } from '../data/db';

function attempt(percent: number, wrong: number[] = [], date = '2026-05-13T00:00:00Z'): QuizAttempt {
  return {
    date,
    percent,
    correctCount: 0,
    gradedCount: 0,
    wrongIndices: wrong,
  };
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

afterEach(async () => {
  await closeDb();
});

describe('quizScoresKey', () => {
  it('returns the documented quiz_scores_<chapterId> shape', () => {
    expect(quizScoresKey('book_1_ch_0')).toBe('quiz_scores_book_1_ch_0');
  });
});

describe('getQuizAttempts', () => {
  it('returns [] when nothing is stored', async () => {
    expect(await getQuizAttempts('ghost')).toEqual([]);
  });
});

describe('recordQuizAttempt', () => {
  it('appends to the existing array', async () => {
    await recordQuizAttempt('c1', attempt(60));
    await recordQuizAttempt('c1', attempt(80));
    const got = await getQuizAttempts('c1');
    expect(got).toHaveLength(2);
    expect(got.map((a) => a.percent)).toEqual([60, 80]);
  });

  it('persists under the settings key with the documented shape', async () => {
    await recordQuizAttempt('c1', attempt(75));
    const stored = await getSetting<QuizAttempt[]>(quizScoresKey('c1'));
    expect(Array.isArray(stored)).toBe(true);
    expect(stored![0]!.percent).toBe(75);
  });

  it('returns the updated full history', async () => {
    const updated = await recordQuizAttempt('c1', attempt(50));
    expect(updated).toHaveLength(1);
    expect(updated[0]!.percent).toBe(50);
  });
});

describe('quizStats', () => {
  it('returns zeros for an empty history', () => {
    expect(quizStats([])).toEqual({ best: 0, count: 0, lastWrongIndices: [] });
  });

  it('reports best as the max across attempts', () => {
    expect(quizStats([attempt(40), attempt(80), attempt(60)]).best).toBe(80);
  });

  it('reports count as the number of attempts', () => {
    expect(quizStats([attempt(40), attempt(80)]).count).toBe(2);
  });

  it('reports lastWrongIndices from the most recent attempt', () => {
    expect(
      quizStats([attempt(40, [0, 1]), attempt(60, [2])]).lastWrongIndices,
    ).toEqual([2]);
  });
});

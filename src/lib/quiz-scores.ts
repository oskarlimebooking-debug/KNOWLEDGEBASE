// Quiz attempt history (TB.6 — AC #2 + #3).
//
// Attempts are stored in the settings store under
// `quiz_scores_<chapterId>` as an append-only array of `QuizAttempt`
// rows. The chapter view's quiz hub reads `quizStats` to display best
// score + attempt count.

import { getSetting, setSetting } from '../data/db';

export interface QuizAttempt {
  date: string; // ISO 8601
  percent: number;
  correctCount: number;
  gradedCount: number;
  wrongIndices: number[];
}

export interface QuizStats {
  best: number;
  count: number;
  lastWrongIndices: number[];
}

export function quizScoresKey(chapterId: string): string {
  return `quiz_scores_${chapterId}`;
}

export async function getQuizAttempts(chapterId: string): Promise<QuizAttempt[]> {
  const stored = await getSetting<unknown>(quizScoresKey(chapterId));
  return Array.isArray(stored) ? (stored as QuizAttempt[]) : [];
}

export async function recordQuizAttempt(
  chapterId: string,
  attempt: QuizAttempt,
): Promise<QuizAttempt[]> {
  const existing = await getQuizAttempts(chapterId);
  const next = [...existing, attempt];
  await setSetting(quizScoresKey(chapterId), next);
  return next;
}

export function quizStats(attempts: ReadonlyArray<QuizAttempt>): QuizStats {
  if (attempts.length === 0) {
    return { best: 0, count: 0, lastWrongIndices: [] };
  }
  const best = attempts.reduce((m, a) => (a.percent > m ? a.percent : m), 0);
  const last = attempts[attempts.length - 1] as QuizAttempt;
  return { best, count: attempts.length, lastWrongIndices: [...last.wrongIndices] };
}

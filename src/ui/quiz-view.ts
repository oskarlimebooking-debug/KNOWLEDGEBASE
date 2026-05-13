// Classic Quiz view (Sprint B / TB.6).
//
// State machine:
//   hub  → loading → in_progress → results → hub …
//                 ↘ error (with Retry)
//
// Hub surfaces: best score, attempt count, and four actions —
//   Start Quiz, Retake Wrong Only, Generate More, Regenerate.
// "Retake Wrong Only" is enabled when the last attempt has wrong items.
// "Generate More" and "Regenerate" hit the provider directly.
//
// All text flows through createTextNode via buildElement (no XSS).

import {
  appendMoreQuestions,
  gradeQuiz,
  loadQuiz,
  regenerateQuiz,
  type MultipleChoiceQuestion,
  type OpenEndedQuestion,
  type Quiz,
  type QuizAnswer,
  type QuizQuestion,
  type QuizScore,
  type TrueFalseQuestion,
} from '../ai/modes/quiz';
import { getSecret } from '../data/secrets';
import type { Chapter } from '../lib/importers/types';
import {
  getQuizAttempts,
  quizStats,
  recordQuizAttempt,
  type QuizStats,
} from '../lib/quiz-scores';
import { buildElement, type ShellNode } from './dom';
import { showToast } from './toast';

interface UIState {
  pane: HTMLElement;
  toastContainer: HTMLElement;
  chapter: Chapter;
  apiKey: string;
  // The active quiz (full or filtered for "retake wrong only").
  quiz: Quiz | null;
  // Index map back to the full quiz when filtered, so we can write
  // wrongIndices using the original positions.
  indexMap: number[]; // current[i] → full quiz index
  currentIndex: number;
  answers: QuizAnswer[];
  stats: QuizStats;
}

export interface ShowQuizOptions {
  toastContainer: HTMLElement;
}

export async function showQuiz(
  chapter: Chapter,
  pane: HTMLElement,
  options: ShowQuizOptions,
): Promise<void> {
  const apiKey = getSecret('aiApiKey') ?? '';
  const stats = quizStats(await getQuizAttempts(chapter.id));
  const state: UIState = {
    pane,
    toastContainer: options.toastContainer,
    chapter,
    apiKey,
    quiz: null,
    indexMap: [],
    currentIndex: 0,
    answers: [],
    stats,
  };
  renderHub(state);
}

// --- Hub ------------------------------------------------------------------

function renderHub(state: UIState): void {
  const hasAttempts = state.stats.count > 0;
  const canRetakeWrong = state.stats.lastWrongIndices.length > 0;

  const tree: ShellNode = {
    tag: 'div',
    className: 'quiz quiz--hub',
    children: [
      { tag: 'h3', className: 'quiz__title', children: ['Classic Quiz'] },
      {
        tag: 'p',
        className: 'quiz__stats',
        children: [
          hasAttempts
            ? `Best ${state.stats.best}% · ${state.stats.count} attempt${state.stats.count === 1 ? '' : 's'}`
            : 'No attempts yet.',
        ],
      },
      {
        tag: 'div',
        className: 'quiz__hub-actions',
        children: [
          {
            tag: 'button',
            className: 'quiz__btn quiz__btn--primary',
            attrs: { type: 'button', 'data-role': 'start' },
            children: [hasAttempts ? 'Start again' : 'Start quiz'],
          },
          ...(canRetakeWrong
            ? [{
                tag: 'button',
                className: 'quiz__btn',
                attrs: { type: 'button', 'data-role': 'retake-wrong' },
                children: [`Retake wrong (${state.stats.lastWrongIndices.length})`],
              } as ShellNode]
            : []),
          ...(hasAttempts
            ? [
                {
                  tag: 'button',
                  className: 'quiz__btn',
                  attrs: { type: 'button', 'data-role': 'more' },
                  children: ['Generate more questions'],
                } as ShellNode,
                {
                  tag: 'button',
                  className: 'quiz__btn quiz__btn--ghost',
                  attrs: { type: 'button', 'data-role': 'regenerate' },
                  children: ['Regenerate'],
                } as ShellNode,
              ]
            : []),
        ],
      },
    ],
  };
  state.pane.replaceChildren(buildElement(tree));
  wireHub(state);
}

function wireHub(state: UIState): void {
  const start = state.pane.querySelector('.quiz__btn[data-role="start"]') as HTMLElement | null;
  const retake = state.pane.querySelector('.quiz__btn[data-role="retake-wrong"]') as HTMLElement | null;
  const more = state.pane.querySelector('.quiz__btn[data-role="more"]') as HTMLElement | null;
  const regen = state.pane.querySelector('.quiz__btn[data-role="regenerate"]') as HTMLElement | null;

  start?.addEventListener('click', () => void startQuiz(state, null));
  retake?.addEventListener('click', () =>
    void startQuiz(state, state.stats.lastWrongIndices),
  );
  more?.addEventListener('click', () => void runMoreQuestions(state));
  regen?.addEventListener('click', () => void runRegenerate(state));
}

// --- Quiz lifecycle -------------------------------------------------------

async function startQuiz(state: UIState, filterIndices: number[] | null): Promise<void> {
  if (state.apiKey === '') {
    renderError(state, 'No API key set. Open Settings → API key to add yours.');
    return;
  }
  renderLoading(state);
  try {
    const full = await loadQuiz(state.chapter, state.apiKey);
    const [filtered, indexMap] = filterQuiz(full, filterIndices);
    if (filtered.questions.length === 0) {
      // No wrong items to retake — fall back to the full quiz.
      state.quiz = full;
      state.indexMap = full.questions.map((_, i) => i);
    } else {
      state.quiz = filtered;
      state.indexMap = indexMap;
    }
    state.currentIndex = 0;
    state.answers = [];
    renderQuestion(state);
  } catch (err) {
    renderError(state, (err as Error).message ?? 'Quiz generation failed');
  }
}

function filterQuiz(quiz: Quiz, filterIndices: number[] | null): [Quiz, number[]] {
  if (filterIndices === null || filterIndices.length === 0) {
    return [quiz, quiz.questions.map((_, i) => i)];
  }
  const filtered: QuizQuestion[] = [];
  const indexMap: number[] = [];
  for (const i of filterIndices) {
    const q = quiz.questions[i];
    if (q !== undefined) {
      filtered.push(q);
      indexMap.push(i);
    }
  }
  return [{ questions: filtered }, indexMap];
}

async function runMoreQuestions(state: UIState): Promise<void> {
  if (state.apiKey === '') {
    renderError(state, 'No API key set.');
    return;
  }
  renderLoading(state);
  try {
    const current = await loadQuiz(state.chapter, state.apiKey);
    await appendMoreQuestions(state.chapter, state.apiKey, current);
    showToast(state.toastContainer, 'Added more questions.', 'success');
    renderHub(state);
  } catch (err) {
    renderError(state, (err as Error).message ?? 'Could not add more questions');
  }
}

async function runRegenerate(state: UIState): Promise<void> {
  if (state.apiKey === '') {
    renderError(state, 'No API key set.');
    return;
  }
  renderLoading(state);
  try {
    await regenerateQuiz(state.chapter, state.apiKey);
    showToast(state.toastContainer, 'Quiz regenerated.', 'success');
    renderHub(state);
  } catch (err) {
    renderError(state, (err as Error).message ?? 'Could not regenerate');
  }
}

// --- Loading / Error ------------------------------------------------------

function renderLoading(state: UIState): void {
  state.pane.replaceChildren(
    buildElement({
      tag: 'div',
      className: 'quiz quiz--loading',
      attrs: { role: 'status', 'aria-live': 'polite' },
      children: [
        { tag: 'div', className: 'quiz__spinner', attrs: { 'aria-hidden': 'true' } },
        { tag: 'p', className: 'quiz__loading-label', children: ['Loading…'] },
      ],
    }),
  );
}

function renderError(state: UIState, message: string): void {
  state.pane.replaceChildren(
    buildElement({
      tag: 'div',
      className: 'quiz quiz--error',
      attrs: { role: 'alert', 'aria-live': 'assertive' },
      children: [
        { tag: 'p', className: 'quiz__error-message', children: [message] },
        {
          tag: 'button',
          className: 'quiz__btn quiz__btn--primary',
          attrs: { type: 'button', 'data-role': 'quiz-retry' },
          children: ['Retry'],
        },
      ],
    }),
  );
  const retry = state.pane.querySelector('.quiz__btn[data-role="quiz-retry"]') as HTMLElement | null;
  retry?.addEventListener('click', () => renderHub(state));
}

// --- Question rendering ---------------------------------------------------

function renderQuestion(state: UIState): void {
  if (state.quiz === null) return;
  const q = state.quiz.questions[state.currentIndex];
  if (q === undefined) {
    void finishQuiz(state);
    return;
  }

  const header: ShellNode = {
    tag: 'p',
    className: 'quiz__progress',
    children: [`Question ${state.currentIndex + 1} of ${state.quiz.questions.length}`],
  };
  const prompt: ShellNode = { tag: 'h3', className: 'quiz__prompt', children: [q.prompt] };

  let body: ShellNode;
  if (q.type === 'multiple_choice') body = renderMCBody(q);
  else if (q.type === 'true_false') body = renderTFBody(q);
  else body = renderOEBody(q);

  state.pane.replaceChildren(
    buildElement({
      tag: 'div',
      className: `quiz quiz--question quiz--${q.type}`,
      children: [header, prompt, body],
    }),
  );
  wireQuestion(state, q);
}

function renderMCBody(q: MultipleChoiceQuestion): ShellNode {
  return {
    tag: 'div',
    className: 'quiz__options',
    children: q.options.map((opt, i) => ({
      tag: 'button',
      className: 'quiz__option',
      attrs: { type: 'button', 'data-role': 'mc-option', 'data-option-index': String(i) },
      children: [opt],
    })),
  };
}

function renderTFBody(_q: TrueFalseQuestion): ShellNode {
  return {
    tag: 'div',
    className: 'quiz__options quiz__options--tf',
    children: [
      {
        tag: 'button',
        className: 'quiz__option',
        attrs: { type: 'button', 'data-role': 'tf-option', 'data-tf': 'true' },
        children: ['True'],
      },
      {
        tag: 'button',
        className: 'quiz__option',
        attrs: { type: 'button', 'data-role': 'tf-option', 'data-tf': 'false' },
        children: ['False'],
      },
    ],
  };
}

function renderOEBody(_q: OpenEndedQuestion): ShellNode {
  return {
    tag: 'div',
    className: 'quiz__open-ended',
    children: [
      {
        tag: 'textarea',
        className: 'quiz__textarea',
        attrs: {
          'data-role': 'oe-input',
          rows: '5',
          placeholder: 'Type your answer…',
        },
      },
      {
        tag: 'button',
        className: 'quiz__btn quiz__btn--primary',
        attrs: { type: 'button', 'data-role': 'oe-submit' },
        children: ['Submit answer'],
      },
    ],
  };
}

function wireQuestion(state: UIState, q: QuizQuestion): void {
  if (q.type === 'multiple_choice') {
    const opts = collectAll(state.pane, '.quiz__option[data-role="mc-option"]');
    opts.forEach((el, i) => {
      el.addEventListener('click', () => {
        const correct = i === q.correctIndex;
        markMCSelection(state, opts, i, q.correctIndex);
        recordAnswer(state, {
          questionIndex: state.indexMap[state.currentIndex] as number,
          type: 'multiple_choice',
          selectedIndex: i,
          correct,
        });
        revealExplanation(state, q.explanation, correct);
      });
    });
  } else if (q.type === 'true_false') {
    const tEl = state.pane.querySelector('.quiz__option[data-tf="true"]') as HTMLElement | null;
    const fEl = state.pane.querySelector('.quiz__option[data-tf="false"]') as HTMLElement | null;
    const handle = (selected: boolean, el: HTMLElement | null): void => {
      const correct = selected === q.correct;
      if (el !== null) el.classList.add(correct ? 'quiz__option--correct' : 'quiz__option--wrong');
      const truthEl = q.correct ? tEl : fEl;
      truthEl?.classList.add('quiz__option--correct');
      tEl?.setAttribute('disabled', 'true');
      fEl?.setAttribute('disabled', 'true');
      recordAnswer(state, {
        questionIndex: state.indexMap[state.currentIndex] as number,
        type: 'true_false',
        selected,
        correct,
      });
      revealExplanation(state, q.explanation, correct);
    };
    tEl?.addEventListener('click', () => handle(true, tEl));
    fEl?.addEventListener('click', () => handle(false, fEl));
  } else {
    const ta = state.pane.querySelector('.quiz__textarea') as HTMLTextAreaElement | null;
    const submit = state.pane.querySelector('.quiz__btn[data-role="oe-submit"]') as HTMLElement | null;
    submit?.addEventListener('click', () => {
      const raw = (ta?.value ?? '').trim();
      if (raw === '') {
        showToast(state.toastContainer, 'Please enter an answer.', 'warn');
        return;
      }
      recordAnswer(state, {
        questionIndex: state.indexMap[state.currentIndex] as number,
        type: 'open_ended',
        text: raw,
        correct: null,
      });
      revealOESample(state, q.sampleAnswer);
    });
  }
}

function collectAll(root: HTMLElement, selector: string): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const el of (root as unknown as { children: HTMLElement[] }).children) {
    collectInto(el, selector, out);
  }
  return out;
}

function collectInto(node: HTMLElement, selector: string, out: HTMLElement[]): void {
  const first = node.querySelector(selector) as HTMLElement | null;
  if (first === null) return;
  // tiny depth-first walk that respects our stub's querySelector (single hit)
  let i = 0;
  while (true) {
    const list = (node as unknown as { children: HTMLElement[] }).children ?? [];
    if (i >= list.length) break;
    const child = list[i] as HTMLElement;
    if ((child as unknown as { classList?: { contains(s: string): boolean } }).classList?.contains(
      selector.replace(/^\.([^[]+)\[.*$/, '$1'),
    )) {
      out.push(child);
    }
    collectInto(child, selector, out);
    i++;
  }
}

function markMCSelection(
  _state: UIState,
  opts: HTMLElement[],
  selectedIndex: number,
  correctIndex: number,
): void {
  opts.forEach((el, i) => {
    el.setAttribute('disabled', 'true');
    if (i === correctIndex) el.classList.add('quiz__option--correct');
    if (i === selectedIndex && i !== correctIndex) el.classList.add('quiz__option--wrong');
  });
}

function recordAnswer(state: UIState, answer: QuizAnswer): void {
  state.answers.push(answer);
}

function revealExplanation(state: UIState, explanation: string, correct: boolean): void {
  appendNext(state, {
    tag: 'div',
    className: `quiz__feedback quiz__feedback--${correct ? 'right' : 'wrong'}`,
    children: [
      {
        tag: 'p',
        className: 'quiz__feedback-label',
        children: [correct ? 'Correct.' : 'Not quite.'],
      },
      { tag: 'p', className: 'quiz__feedback-text', children: [explanation] },
    ],
  });
  appendNextButton(state);
}

function revealOESample(state: UIState, sample: string): void {
  appendNext(state, {
    tag: 'div',
    className: 'quiz__feedback',
    children: [
      { tag: 'p', className: 'quiz__feedback-label', children: ['Sample answer'] },
      { tag: 'p', className: 'quiz__feedback-text', children: [sample] },
    ],
  });
  appendNextButton(state);
}

function appendNext(state: UIState, node: ShellNode): void {
  (state.pane.firstChild as HTMLElement | null)?.appendChild(buildElement(node));
}

function appendNextButton(state: UIState): void {
  const isLast = state.quiz !== null && state.currentIndex === state.quiz.questions.length - 1;
  const btn = buildElement({
    tag: 'button',
    className: 'quiz__btn quiz__btn--primary',
    attrs: { type: 'button', 'data-role': 'quiz-next' },
    children: [isLast ? 'See results' : 'Next question'],
  });
  (state.pane.firstChild as HTMLElement | null)?.appendChild(btn);
  btn.addEventListener('click', () => {
    if (isLast) void finishQuiz(state);
    else {
      state.currentIndex++;
      renderQuestion(state);
    }
  });
}

// --- Results --------------------------------------------------------------

async function finishQuiz(state: UIState): Promise<void> {
  if (state.quiz === null) return;
  const score = gradeQuiz(state.quiz, state.answers);
  // Map wrongIndices back to the original quiz positions.
  const wrongFull = score.wrongIndices.map((i) => state.indexMap[i] as number);
  const attempt = {
    date: new Date().toISOString(),
    percent: score.percent,
    correctCount: score.correctCount,
    gradedCount: score.gradedCount,
    wrongIndices: wrongFull,
  };
  const updated = await recordQuizAttempt(state.chapter.id, attempt);
  state.stats = quizStats(updated);
  renderResults(state, score, wrongFull);
}

function renderResults(state: UIState, score: QuizScore, _wrongFull: number[]): void {
  state.pane.replaceChildren(
    buildElement({
      tag: 'div',
      className: 'quiz quiz--results',
      children: [
        { tag: 'h3', className: 'quiz__title', children: ['Results'] },
        {
          tag: 'p',
          className: 'quiz__score-line',
          attrs: { 'data-role': 'score-line' },
          children: [
            `You scored ${score.percent}% (${score.correctCount} / ${score.gradedCount})`,
          ],
        },
        ...(score.wrongIndices.length > 0
          ? [{
              tag: 'p',
              className: 'quiz__results-detail',
              children: [`${score.wrongIndices.length} wrong — try "Retake wrong" from the hub.`],
            } as ShellNode]
          : []),
        {
          tag: 'div',
          className: 'quiz__results-actions',
          children: [
            {
              tag: 'button',
              className: 'quiz__btn quiz__btn--primary',
              attrs: { type: 'button', 'data-role': 'results-hub' },
              children: ['Back to hub'],
            },
          ],
        },
      ],
    }),
  );
  const back = state.pane.querySelector('.quiz__btn[data-role="results-hub"]') as HTMLElement | null;
  back?.addEventListener('click', () => renderHub(state));
}

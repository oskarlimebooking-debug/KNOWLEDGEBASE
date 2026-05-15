// Settings UI: Prompts section (Sprint B / TB.2).
//
// One row per generator (summary, quiz, flashcards, teachback,
// formatText, chapterSplit). Each row holds a <textarea> seeded with
// the current prompt value and a "Reset to default" button that wipes
// the override from IDB.
//
// XSS posture: prompt strings (defaults + user overrides) only enter
// the DOM as string children of <textarea>, which the shared
// `buildElement` helper materialises via `createTextNode`. There is no
// `innerHTML`/`insertAdjacentHTML` anywhere on this path, and the
// textarea's `.value` setter (used on reset/seed at runtime) accepts a
// plain string — no HTML parsing.

import {
  DEFAULT_PROMPTS,
  PROMPT_KEYS,
  type PromptKey,
  getPrompt,
  resetPrompt,
  setPrompt,
} from '../ai/prompts';
import { buildElement, type ShellNode } from './dom';

export const PROMPT_LABELS: Readonly<Record<PromptKey, string>> = Object.freeze({
  summary: 'Summary',
  quiz: 'Quiz',
  flashcards: 'Flashcards',
  teachback: 'Teach-Back',
  formatText: 'Format Text',
  chapterSplit: 'Chapter Detection',
});

export async function loadAllPrompts(): Promise<Record<PromptKey, string>> {
  const entries = await Promise.all(
    PROMPT_KEYS.map(async (k) => [k, await getPrompt(k)] as const),
  );
  return Object.fromEntries(entries) as Record<PromptKey, string>;
}

function promptRow(key: PromptKey, value: string): ShellNode {
  return {
    tag: 'div',
    className: 'prompts__row',
    attrs: { 'data-prompt-key': key },
    children: [
      {
        tag: 'div',
        className: 'prompts__header',
        children: [
          { tag: 'h4', className: 'prompts__label', children: [PROMPT_LABELS[key]] },
          {
            tag: 'button',
            className: 'prompts__reset',
            attrs: { type: 'button', 'data-role': 'prompt-reset' },
            children: ['Reset to default'],
          },
        ],
      },
      {
        tag: 'textarea',
        className: 'prompts__textarea',
        attrs: {
          'data-role': 'prompt-textarea',
          rows: '6',
          spellcheck: 'false',
          'aria-label': `${PROMPT_LABELS[key]} prompt`,
        },
        children: [value],
      },
    ],
  };
}

export function buildPromptsSection(
  values: Record<PromptKey, string>,
  doc: Document = document,
): HTMLElement {
  const tree: ShellNode = {
    tag: 'section',
    className: 'settings__section settings__section--prompts',
    children: [
      { tag: 'h3', className: 'settings__heading', children: ['Prompts'] },
      {
        tag: 'p',
        className: 'settings__hint',
        children: ['Customize the instructions sent to the AI for each generator.'],
      },
      ...PROMPT_KEYS.map((k) => promptRow(k, values[k])),
    ],
  };
  return buildElement(tree, doc);
}

function readTextareaValue(el: HTMLTextAreaElement): string {
  const valueProp = (el as unknown as { value?: unknown }).value;
  if (typeof valueProp === 'string') return valueProp;
  return el.textContent ?? '';
}

function writeTextareaValue(el: HTMLTextAreaElement, value: string): void {
  // Both textContent (initial DOM value) and .value (the displayed value
  // once the user has dirtied the field) need updating on a reset.
  // The DOM treats these as plain strings — never HTML — so this stays
  // XSS-safe.
  el.textContent = value;
  (el as unknown as { value: string }).value = value;
}

export function wirePromptsSection(section: HTMLElement): void {
  for (const key of PROMPT_KEYS) {
    const row = section.querySelector(
      `[data-prompt-key="${key}"]`,
    ) as HTMLElement | null;
    if (row === null) continue;
    const textarea = row.querySelector(
      '[data-role="prompt-textarea"]',
    ) as HTMLTextAreaElement | null;
    const resetBtn = row.querySelector(
      '[data-role="prompt-reset"]',
    ) as HTMLElement | null;
    if (textarea === null || resetBtn === null) continue;

    const onInput = (): void => {
      void setPrompt(key, readTextareaValue(textarea));
    };
    textarea.addEventListener('input', onInput);
    textarea.addEventListener('change', onInput);

    resetBtn.addEventListener('click', () => {
      void resetPrompt(key).then(() => {
        writeTextareaValue(textarea, DEFAULT_PROMPTS[key]);
      });
    });
  }
}

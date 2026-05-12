// Prompts as data (Sprint B / TB.2).
//
// Every AI generator (summary, quiz, flashcards, teachback, formatText,
// chapterSplit) ships with a default prompt string in DEFAULT_PROMPTS.
// Users may override any prompt from the Settings UI; overrides are
// stored in the IDB `settings` store under `prompt_<key>` and survive
// reload. `getPrompt` returns the override when present (and non-empty),
// otherwise the default. `resetPrompt` deletes the override row, so the
// next call falls back to the default.
//
// Prompts are pure data — never executed, never rendered as HTML. The
// settings UI binds them into <textarea> children via createTextNode
// (see ui/dom.ts), so there is no path from authored prompt content to
// script execution.

import { dbDelete, getSetting, setSetting } from '../data/db';
import { STORE_SETTINGS } from '../data/schema';

export type PromptKey =
  | 'summary'
  | 'quiz'
  | 'flashcards'
  | 'teachback'
  | 'formatText'
  | 'chapterSplit';

export const PROMPT_KEYS: ReadonlyArray<PromptKey> = Object.freeze([
  'summary',
  'quiz',
  'flashcards',
  'teachback',
  'formatText',
  'chapterSplit',
]);

const SUMMARY_DEFAULT = `You are summarizing a chapter for a learner. Read the title and content below, then return ONLY a JSON object with this exact shape (no prose outside the JSON):

{
  "keyConcepts": ["3 to 5 short strings, each one key idea"],
  "summary": "2-3 short paragraphs of plain text",
  "difficulty": 1,
  "readingTime": 1
}

- "difficulty" is an integer 1 (very easy) to 5 (very hard).
- "readingTime" is the estimated minutes to read the original chapter.

Title: {title}

Content:
{content}`;

const QUIZ_DEFAULT = `Generate a 5-question quiz from the chapter below. Return ONLY a JSON object with this shape:

{
  "questions": [
    { "type": "multipleChoice", "question": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0, "explanation": "..." },
    { "type": "multipleChoice", "question": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0, "explanation": "..." },
    { "type": "multipleChoice", "question": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0, "explanation": "..." },
    { "type": "trueFalse", "question": "...", "correct": true, "explanation": "..." },
    { "type": "openEnded", "question": "...", "sampleAnswer": "..." }
  ]
}

Title: {title}

Content:
{content}`;

const FLASHCARDS_DEFAULT = `Generate 8-12 flashcards from the chapter below. Return ONLY a JSON object with this shape:

{
  "cards": [
    { "front": "term or question", "back": "definition or answer" }
  ]
}

Keep front sides short (1 line). Back sides should be 1-2 sentences.

Title: {title}

Content:
{content}`;

const TEACHBACK_DEFAULT = `You are a Socratic tutor running a teach-back session for the chapter below. Ask the learner to explain the core idea in their own words, then probe their explanation with 2-3 follow-up questions. Be kind, curious, and concrete. Return ONLY a JSON object with this shape:

{
  "openingPrompt": "the first question to ask the learner",
  "followUps": ["3 short follow-up probes, each a single question"],
  "evaluationRubric": "1-2 sentences describing what a strong explanation covers"
}

Title: {title}

Content:
{content}`;

const FORMAT_TEXT_DEFAULT = `Clean up the raw text below for readability. Fix obvious OCR/PDF artefacts: rejoin words split across line breaks, restore paragraph breaks at sentence boundaries, and remove page-number/header/footer noise. Do not paraphrase, summarize, translate, or change wording — only reformat.

Return ONLY the cleaned plain-text content. No commentary.

Raw text:
{content}`;

const CHAPTER_SPLIT_DEFAULT = `You are improving chapter titles for a book that was split by pattern matching. Below is the array of chapters, each with the auto-detected title and a short snippet of opening content. Return ONLY a JSON array of improved titles, in the same order:

["Improved title 1", "Improved title 2", ...]

Keep titles short (under 60 characters). If the existing title is already good, return it unchanged.

Chapters:
{chapters}`;

export const DEFAULT_PROMPTS: Readonly<Record<PromptKey, string>> = Object.freeze({
  summary: SUMMARY_DEFAULT,
  quiz: QUIZ_DEFAULT,
  flashcards: FLASHCARDS_DEFAULT,
  teachback: TEACHBACK_DEFAULT,
  formatText: FORMAT_TEXT_DEFAULT,
  chapterSplit: CHAPTER_SPLIT_DEFAULT,
});

export function promptSettingKey(key: PromptKey): string {
  return `prompt_${key}`;
}

export async function getPrompt(key: PromptKey): Promise<string> {
  const override = await getSetting<string>(promptSettingKey(key));
  if (typeof override === 'string' && override.length > 0) return override;
  return DEFAULT_PROMPTS[key];
}

export async function setPrompt(key: PromptKey, value: string): Promise<void> {
  await setSetting(promptSettingKey(key), value);
}

export async function resetPrompt(key: PromptKey): Promise<void> {
  await dbDelete(STORE_SETTINGS, promptSettingKey(key));
}

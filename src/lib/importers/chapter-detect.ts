// Pattern-based chapter detection (Sprint B / TB.3).
//
// `detectChapterPatterns(text)` tries a small ordered list of regexes
// against the input. The first regex with ≥ 2 line-start matches wins —
// the text is split at those match positions and returned as a
// `ChapterSlice[]` (the same shape the word-count splitter produces).
// If no pattern matches ≥ 2 times, we return `null` so the caller can
// fall back to the word-count splitter silently (no console noise — AC).
//
// Priority order (first to ≥ 2 wins):
//   1. `Chapter <num|roman|word>`     novels
//   2. `Part <num|roman>`             textbooks
//   3. `Section <num[.num]>`          papers
//   4. `<num|roman>. <Title>` headings on their own line   fallback
//
// `enhanceChapterTitles` upgrades titles in ONE batched `callAnthropic`
// call. Failure is silent — we return the chapters unchanged.

import { callAnthropic } from '../../ai/anthropic';
import type { ChapterSlice } from './chapters';

const PATTERNS: ReadonlyArray<{ name: string; regex: RegExp }> = [
  // Chapter: digit / roman / word (Chapter 1 / Chapter I / Chapter ONE)
  { name: 'chapter', regex: /^[ \t]*chapter\s+(?:\d+|[ivxlcdm]+|[a-z]+)\b[^\n]*$/gim },
  // Part: digit / roman
  { name: 'part', regex: /^[ \t]*part\s+(?:\d+|[ivxlcdm]+)\b[^\n]*$/gim },
  // Section: digit, optionally dotted (Section 1, Section 1.2.3)
  { name: 'section', regex: /^[ \t]*section\s+\d+(?:\.\d+)*\b[^\n]*$/gim },
  // Numeric/Roman heading on its own line followed by a capitalized title.
  // Conservative — requires the heading marker AND a title on the same line
  // so we don't fire on prose lines that happen to start with a number.
  { name: 'numbered', regex: /^[ \t]*(?:\d{1,3}|[IVXLCDM]{1,5})\.\s+[A-Z][^\n]{0,120}$/gm },
];

const MAX_TITLE_LEN = 100;

export function detectChapterPatterns(text: string): ChapterSlice[] | null {
  if (text.length === 0) return null;
  for (const { regex } of PATTERNS) {
    const slices = splitByRegex(text, regex);
    if (slices !== null) return slices;
  }
  return null;
}

function splitByRegex(text: string, regex: RegExp): ChapterSlice[] | null {
  const matches: { index: number; title: string }[] = [];
  // Use a fresh RegExp so global state from prior calls doesn't bleed in.
  const re = new RegExp(regex.source, regex.flags);
  for (const m of text.matchAll(re)) {
    if (m.index === undefined) continue;
    matches.push({ index: m.index, title: trimTitle(m[0]) });
  }
  if (matches.length < 2) return null;
  const slices: ChapterSlice[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i]!.index;
    const end = i + 1 < matches.length ? matches[i + 1]!.index : text.length;
    slices.push({
      index: i,
      title: matches[i]!.title,
      content: text.slice(start, end).trim(),
    });
  }
  return slices;
}

function trimTitle(raw: string): string {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  return collapsed.length > MAX_TITLE_LEN ? collapsed.slice(0, MAX_TITLE_LEN) : collapsed;
}

// --- AI title enhancement -------------------------------------------------

const ENHANCE_PROMPT_HEADER =
  'For each numbered chapter excerpt below, suggest a concise 2-6 word title' +
  ' that captures its main topic. Return ONLY a JSON array of strings, one' +
  ' per excerpt, in the same order. No prose, no markdown.';

const ENHANCE_SCHEMA = {
  type: 'array',
  items: { type: 'string' },
} as const;

const PREVIEW_CHARS = 240;

export async function enhanceChapterTitles(
  chapters: ChapterSlice[],
  apiKey: string,
  modelOverride?: string,
): Promise<ChapterSlice[]> {
  if (chapters.length === 0 || apiKey.length === 0) return chapters;

  const previews = chapters
    .map((c, i) => `[${i}]\n${c.content.slice(0, PREVIEW_CHARS).trim()}`)
    .join('\n\n---\n\n');
  const prompt = `${ENHANCE_PROMPT_HEADER}\n\n${previews}`;

  try {
    const raw = await callAnthropic(prompt, apiKey, modelOverride, {
      jsonSchema: ENHANCE_SCHEMA as unknown as Record<string, unknown>,
      maxOutputTokens: 2000,
      thinking: false, // title generation doesn't need adaptive reasoning
    });
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return chapters;
    return chapters.map((c, i) => {
      const t = parsed[i];
      return typeof t === 'string' && t.trim().length > 0
        ? { ...c, title: trimTitle(t) }
        : c;
    });
  } catch {
    return chapters;
  }
}

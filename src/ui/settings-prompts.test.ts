import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import { closeDb, getSetting } from '../data/db';
import { DEFAULT_PROMPTS, PROMPT_KEYS, setPrompt } from '../ai/prompts';
import { asDocument, makeDoc, type StubElement } from '../test/dom-stub';

import {
  PROMPT_LABELS,
  buildPromptsSection,
  loadAllPrompts,
  wirePromptsSection,
} from './settings-prompts';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

afterEach(async () => {
  await closeDb();
});

function findRow(section: StubElement, key: string): StubElement {
  const row = section.querySelector(`[data-prompt-key="${key}"]`);
  if (row === null) throw new Error(`row for ${key} not found`);
  return row;
}

function findTextarea(row: StubElement): StubElement {
  const ta = row.querySelector('[data-role="prompt-textarea"]');
  if (ta === null) throw new Error('textarea not found');
  return ta;
}

function findResetButton(row: StubElement): StubElement {
  const btn = row.querySelector('[data-role="prompt-reset"]');
  if (btn === null) throw new Error('reset button not found');
  return btn;
}

describe('PROMPT_LABELS', () => {
  it('has a human-readable label for every prompt key', () => {
    for (const k of PROMPT_KEYS) {
      expect(typeof PROMPT_LABELS[k]).toBe('string');
      expect(PROMPT_LABELS[k].length).toBeGreaterThan(0);
    }
  });
});

describe('loadAllPrompts', () => {
  it('returns the defaults for every key when no overrides exist', async () => {
    const all = await loadAllPrompts();
    for (const k of PROMPT_KEYS) {
      expect(all[k]).toBe(DEFAULT_PROMPTS[k]);
    }
  });

  it('returns overrides where stored', async () => {
    await setPrompt('summary', 'custom-summary');
    await setPrompt('quiz', 'custom-quiz');
    const all = await loadAllPrompts();
    expect(all.summary).toBe('custom-summary');
    expect(all.quiz).toBe('custom-quiz');
    expect(all.flashcards).toBe(DEFAULT_PROMPTS.flashcards);
  });
});

describe('buildPromptsSection', () => {
  it('renders one row per prompt key', async () => {
    const doc = makeDoc();
    const values = await loadAllPrompts();
    const section = buildPromptsSection(values, asDocument(doc)) as unknown as StubElement;
    for (const k of PROMPT_KEYS) {
      expect(() => findRow(section, k)).not.toThrow();
    }
  });

  it('seeds each textarea with the current value via text node (no innerHTML)', async () => {
    const doc = makeDoc();
    const values = await loadAllPrompts();
    const section = buildPromptsSection(values, asDocument(doc)) as unknown as StubElement;
    for (const k of PROMPT_KEYS) {
      const ta = findTextarea(findRow(section, k));
      expect(ta.tagName).toBe('textarea');
      expect(ta.textContent).toBe(DEFAULT_PROMPTS[k]);
      // children must be a single text node — never an HTML-string child.
      const allChildren = ta.children;
      expect(allChildren.every((c) => c.tagName === '#text')).toBe(true);
    }
  });

  it('renders the human label for every row', async () => {
    const doc = makeDoc();
    const values = await loadAllPrompts();
    const section = buildPromptsSection(values, asDocument(doc)) as unknown as StubElement;
    for (const k of PROMPT_KEYS) {
      const row = findRow(section, k);
      expect(row.textContent).toContain(PROMPT_LABELS[k]);
    }
  });

  it('reflects stored overrides in the textareas', async () => {
    await setPrompt('flashcards', 'my flashcards prompt');
    const doc = makeDoc();
    const values = await loadAllPrompts();
    const section = buildPromptsSection(values, asDocument(doc)) as unknown as StubElement;
    const ta = findTextarea(findRow(section, 'flashcards'));
    expect(ta.textContent).toBe('my flashcards prompt');
  });

  it('uses no HTML-string children anywhere in the tree (XSS guard)', async () => {
    const doc = makeDoc();
    const values = await loadAllPrompts();
    const section = buildPromptsSection(values, asDocument(doc)) as unknown as StubElement;
    const walk = (n: StubElement): void => {
      for (const c of n.children) {
        if (c.tagName === '#text') {
          // text node — fine.
          continue;
        }
        // every element child must itself be an element, not a parsed HTML chunk.
        // We assert by checking textContent never contains a literal `<script` —
        // a regression guard that would catch any future innerHTML drift.
        expect(c.tagName.startsWith('#')).toBe(false);
        walk(c);
      }
    };
    walk(section);
    expect(section.textContent.includes('<script')).toBe(false);
  });
});

describe('wirePromptsSection', () => {
  it('clicking Reset deletes the override and restores the default in the textarea', async () => {
    await setPrompt('summary', 'custom one');
    const doc = makeDoc();
    const values = await loadAllPrompts();
    const section = buildPromptsSection(values, asDocument(doc)) as unknown as StubElement;
    wirePromptsSection(section as never);
    const row = findRow(section, 'summary');
    const ta = findTextarea(row);
    const btn = findResetButton(row);
    expect(ta.textContent).toBe('custom one');
    btn.dispatchEvent('click');
    // Allow the async resetPrompt to settle.
    await new Promise((r) => setTimeout(r, 0));
    expect(await getSetting<string>('prompt_summary')).toBeUndefined();
    expect(ta.textContent).toBe(DEFAULT_PROMPTS.summary);
  });

  it('typing into a textarea persists the override via setPrompt', async () => {
    const doc = makeDoc();
    const values = await loadAllPrompts();
    const section = buildPromptsSection(values, asDocument(doc)) as unknown as StubElement;
    wirePromptsSection(section as never);
    const row = findRow(section, 'quiz');
    const ta = findTextarea(row);
    (ta as unknown as { value: string }).value = 'new quiz override';
    ta.dispatchEvent('input');
    await new Promise((r) => setTimeout(r, 0));
    expect(await getSetting<string>('prompt_quiz')).toBe('new quiz override');
  });

  it('reset on a key with no override is a no-op (still restores default)', async () => {
    const doc = makeDoc();
    const values = await loadAllPrompts();
    const section = buildPromptsSection(values, asDocument(doc)) as unknown as StubElement;
    wirePromptsSection(section as never);
    const row = findRow(section, 'teachback');
    const btn = findResetButton(row);
    expect(() => btn.dispatchEvent('click')).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    const ta = findTextarea(row);
    expect(ta.textContent).toBe(DEFAULT_PROMPTS.teachback);
  });
});

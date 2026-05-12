import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import { closeDb, getSetting, setSetting } from '../data/db';

import {
  DEFAULT_PROMPTS,
  PROMPT_KEYS,
  getPrompt,
  promptSettingKey,
  resetPrompt,
  setPrompt,
} from './prompts';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

afterEach(async () => {
  await closeDb();
});

describe('PROMPT_KEYS and DEFAULT_PROMPTS', () => {
  it('exposes exactly the 6 generator keys in a stable order', () => {
    expect(PROMPT_KEYS).toEqual([
      'summary',
      'quiz',
      'flashcards',
      'teachback',
      'formatText',
      'chapterSplit',
    ]);
  });

  it('ships a non-empty default for every key', () => {
    for (const k of PROMPT_KEYS) {
      const def = DEFAULT_PROMPTS[k];
      expect(typeof def).toBe('string');
      expect(def.length).toBeGreaterThan(0);
    }
  });

  it('freezes the registry to prevent runtime mutation', () => {
    expect(Object.isFrozen(PROMPT_KEYS)).toBe(true);
    expect(Object.isFrozen(DEFAULT_PROMPTS)).toBe(true);
  });
});

describe('promptSettingKey', () => {
  it('namespaces prompts under prompt_<key>', () => {
    expect(promptSettingKey('summary')).toBe('prompt_summary');
    expect(promptSettingKey('chapterSplit')).toBe('prompt_chapterSplit');
  });
});

describe('getPrompt / setPrompt', () => {
  it('returns the default when no override is stored', async () => {
    expect(await getPrompt('summary')).toBe(DEFAULT_PROMPTS.summary);
  });

  it('returns the override when one is stored', async () => {
    await setPrompt('summary', 'my custom summary prompt');
    expect(await getPrompt('summary')).toBe('my custom summary prompt');
  });

  it('persists across DB close+reopen (reload simulation)', async () => {
    await setPrompt('quiz', 'custom quiz prompt');
    await closeDb();
    expect(await getPrompt('quiz')).toBe('custom quiz prompt');
  });

  it('writes under the prompt_<key> setting row', async () => {
    await setPrompt('flashcards', 'flash override');
    expect(await getSetting<string>('prompt_flashcards')).toBe('flash override');
  });

  it('keeps overrides isolated between keys', async () => {
    await setPrompt('summary', 'A');
    await setPrompt('quiz', 'B');
    expect(await getPrompt('summary')).toBe('A');
    expect(await getPrompt('quiz')).toBe('B');
    expect(await getPrompt('flashcards')).toBe(DEFAULT_PROMPTS.flashcards);
  });

  it('treats an empty-string override as no override (falls back to default)', async () => {
    await setSetting('prompt_summary', '');
    expect(await getPrompt('summary')).toBe(DEFAULT_PROMPTS.summary);
  });
});

describe('resetPrompt', () => {
  it('deletes the override row from IDB', async () => {
    await setPrompt('teachback', 'custom teach');
    expect(await getSetting<string>('prompt_teachback')).toBe('custom teach');
    await resetPrompt('teachback');
    expect(await getSetting<string>('prompt_teachback')).toBeUndefined();
  });

  it('makes the next getPrompt call return the default', async () => {
    await setPrompt('formatText', 'custom format');
    await resetPrompt('formatText');
    expect(await getPrompt('formatText')).toBe(DEFAULT_PROMPTS.formatText);
  });

  it('is idempotent when no override exists', async () => {
    await expect(resetPrompt('chapterSplit')).resolves.toBeUndefined();
    expect(await getPrompt('chapterSplit')).toBe(DEFAULT_PROMPTS.chapterSplit);
  });

  it('does not touch other overrides', async () => {
    await setPrompt('summary', 'A');
    await setPrompt('quiz', 'B');
    await resetPrompt('summary');
    expect(await getPrompt('summary')).toBe(DEFAULT_PROMPTS.summary);
    expect(await getPrompt('quiz')).toBe('B');
  });
});

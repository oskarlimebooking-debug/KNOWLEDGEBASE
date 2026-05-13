import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import { FALLBACK_MODELS } from '../ai/anthropic';
import { closeDb, dbDelete, getSetting, setSetting } from '../data/db';
import { STORE_SETTINGS } from '../data/schema';
import { clearAllSecrets, getSecret, setSecret } from '../data/secrets';
import {
  asDocument,
  asHTMLElement,
  makeDoc,
  type StubElement,
} from '../test/dom-stub';

import {
  buildProviderSection,
  loadProviderState,
  wireProviderSection,
} from './settings-provider';

const API_KEY = 'sk-ant-test-abc123';

function modelsListResponse(ids: string[]): Response {
  const body = {
    data: ids.map((id) => ({ id, type: 'model', display_name: id })),
    has_more: false,
    first_id: ids[0] ?? null,
    last_id: ids[ids.length - 1] ?? null,
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status: number): Response {
  return new Response(
    JSON.stringify({ type: 'error', error: { type: 'api_error', message } }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  await dbDelete(STORE_SETTINGS, 'selectedModel');
  clearAllSecrets();
  vi.restoreAllMocks();
});

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  clearAllSecrets();
  await closeDb();
});

function findEl(section: StubElement, selector: string): StubElement {
  const el = section.querySelector(selector);
  if (el === null) throw new Error(`element not found: ${selector}`);
  return el;
}

function setInputValue(el: StubElement, value: string): void {
  (el as unknown as { value: string }).value = value;
}

describe('loadProviderState', () => {
  it('returns empty key and default model when nothing set', async () => {
    const state = await loadProviderState();
    expect(state.apiKey).toBe('');
    expect(state.selectedModel).toBe('claude-opus-4-7');
    expect(state.availableModels).toEqual([]);
  });

  it('reflects an in-memory key (memory-only — never persisted)', async () => {
    setSecret('anthropicApiKey', API_KEY);
    const state = await loadProviderState();
    expect(state.apiKey).toBe(API_KEY);
    // With a key in memory, seed availableModels from FALLBACK_MODELS so
    // the dropdown renders something even before the user hits Test/Refresh.
    expect(state.availableModels.length).toBeGreaterThan(0);
  });

  it('reflects the persisted selectedModel', async () => {
    await setSetting('selectedModel', 'claude-haiku-4-5');
    const state = await loadProviderState();
    expect(state.selectedModel).toBe('claude-haiku-4-5');
  });

  it('never reads from or writes to IDB for the API key (AC #1)', async () => {
    setSecret('anthropicApiKey', API_KEY);
    await loadProviderState();
    // No setting row should ever appear for the key — that's the entire
    // point of the memory-only secret store.
    expect(await getSetting<string>('anthropicApiKey')).toBeUndefined();
    expect(await getSetting<string>('apiKey')).toBeUndefined();
  });
});

describe('buildProviderSection — render', () => {
  it('renders an AI Provider section heading', async () => {
    const doc = makeDoc();
    const state = await loadProviderState();
    const section = buildProviderSection(
      state,
      asDocument(doc),
    ) as unknown as StubElement;
    // h3 heading text
    const headings: string[] = [];
    const walk = (n: StubElement): void => {
      if (n.tagName === 'h3') headings.push(n.textContent);
      for (const c of n.children) walk(c);
    };
    walk(section);
    expect(headings).toContain('AI Provider');
  });

  it('renders a password-typed key input with a show/hide toggle', async () => {
    const doc = makeDoc();
    const state = await loadProviderState();
    const section = buildProviderSection(
      state,
      asDocument(doc),
    ) as unknown as StubElement;
    const input = findEl(section, '[data-role="provider-key-input"]');
    expect(input.tagName).toBe('input');
    expect(input.getAttribute('type')).toBe('password');
    expect(input.getAttribute('autocomplete')).toBe('off');
    expect(input.getAttribute('spellcheck')).toBe('false');
    // toggle exists
    const toggle = findEl(section, '[data-role="provider-key-toggle"]');
    expect(toggle.tagName).toBe('button');
  });

  it('renders Test Connection and Refresh Models controls', async () => {
    const doc = makeDoc();
    const state = await loadProviderState();
    const section = buildProviderSection(
      state,
      asDocument(doc),
    ) as unknown as StubElement;
    const test = findEl(section, '[data-role="provider-test"]');
    expect(test.tagName).toBe('button');
    expect(test.textContent).toMatch(/Test connection/i);
    const refresh = findEl(section, '[data-role="provider-refresh"]');
    expect(refresh.textContent).toMatch(/Refresh models/i);
  });

  it('renders a model dropdown (<select>) seeded with current model + availableModels', async () => {
    setSecret('anthropicApiKey', API_KEY);
    const doc = makeDoc();
    const state = await loadProviderState();
    const section = buildProviderSection(
      state,
      asDocument(doc),
    ) as unknown as StubElement;
    const select = findEl(section, '[data-role="provider-model"]');
    expect(select.tagName).toBe('select');
    const options = select.children.filter((c) => c.tagName === 'option');
    expect(options.length).toBeGreaterThan(0);
    const values = options.map((o) => o.getAttribute('value'));
    // AC #3: Anthropic Opus / Sonnet / Haiku tiers present
    expect(values).toContain('claude-opus-4-7');
    expect(values.some((v) => v?.startsWith('claude-sonnet'))).toBe(true);
    expect(values.some((v) => v?.startsWith('claude-haiku'))).toBe(true);
  });

  it('marks the current selectedModel option as selected', async () => {
    await setSetting('selectedModel', 'claude-sonnet-4-6');
    setSecret('anthropicApiKey', API_KEY);
    const doc = makeDoc();
    const state = await loadProviderState();
    const section = buildProviderSection(
      state,
      asDocument(doc),
    ) as unknown as StubElement;
    const select = findEl(section, '[data-role="provider-model"]');
    const sonnet = select.children.find(
      (c) => c.getAttribute('value') === 'claude-sonnet-4-6',
    );
    expect(sonnet?.getAttribute('selected')).toBe('');
  });

  it('seeds the key input value with the current memory-only key', async () => {
    setSecret('anthropicApiKey', API_KEY);
    const doc = makeDoc();
    const state = await loadProviderState();
    const section = buildProviderSection(
      state,
      asDocument(doc),
    ) as unknown as StubElement;
    const input = findEl(section, '[data-role="provider-key-input"]');
    expect(input.getAttribute('value')).toBe(API_KEY);
  });

  it('uses no innerHTML — all children are elements or text nodes (XSS guard)', async () => {
    const doc = makeDoc();
    const state = await loadProviderState();
    const section = buildProviderSection(
      state,
      asDocument(doc),
    ) as unknown as StubElement;
    const walk = (n: StubElement): void => {
      for (const c of n.children) {
        // Either an element or a text node; never an HTML chunk.
        expect(c.tagName.startsWith('#') === false || c.tagName === '#text').toBe(true);
        walk(c);
      }
    };
    walk(section);
  });
});

describe('wireProviderSection — key persistence (AC #1)', () => {
  it('typing into the key field calls setSecret (in-memory, never IDB)', async () => {
    const doc = makeDoc();
    const state = await loadProviderState();
    const section = buildProviderSection(
      state,
      asDocument(doc),
    ) as unknown as StubElement;
    const toastContainer = doc.createElement('div');
    wireProviderSection(section as never, asHTMLElement(toastContainer));
    const input = findEl(section, '[data-role="provider-key-input"]');
    setInputValue(input, API_KEY);
    input.dispatchEvent('input');
    // Memory-only: getSecret returns the value, IDB stays clean.
    expect(getSecret('anthropicApiKey')).toBe(API_KEY);
    expect(await getSetting<string>('anthropicApiKey')).toBeUndefined();
    expect(await getSetting<string>('apiKey')).toBeUndefined();
  });

  it('clearing the input clears the secret', async () => {
    setSecret('anthropicApiKey', API_KEY);
    const doc = makeDoc();
    const state = await loadProviderState();
    const section = buildProviderSection(
      state,
      asDocument(doc),
    ) as unknown as StubElement;
    const toastContainer = doc.createElement('div');
    wireProviderSection(section as never, asHTMLElement(toastContainer));
    const input = findEl(section, '[data-role="provider-key-input"]');
    setInputValue(input, '');
    input.dispatchEvent('input');
    expect(getSecret('anthropicApiKey')).toBeUndefined();
  });
});

describe('wireProviderSection — show/hide toggle', () => {
  it('clicking the toggle flips the input type between password and text', async () => {
    const doc = makeDoc();
    const state = await loadProviderState();
    const section = buildProviderSection(
      state,
      asDocument(doc),
    ) as unknown as StubElement;
    const toastContainer = doc.createElement('div');
    wireProviderSection(section as never, asHTMLElement(toastContainer));
    const input = findEl(section, '[data-role="provider-key-input"]');
    const toggle = findEl(section, '[data-role="provider-key-toggle"]');
    expect(input.getAttribute('type')).toBe('password');
    toggle.dispatchEvent('click');
    expect(input.getAttribute('type')).toBe('text');
    toggle.dispatchEvent('click');
    expect(input.getAttribute('type')).toBe('password');
  });
});

describe('wireProviderSection — Test Connection (AC #2)', () => {
  it('on success: populates the dropdown and shows a success toast', async () => {
    setSecret('anthropicApiKey', API_KEY);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      modelsListResponse(['claude-opus-4-7', 'claude-sonnet-4-6']),
    );
    const doc = makeDoc();
    const state = await loadProviderState();
    const section = buildProviderSection(
      state,
      asDocument(doc),
    ) as unknown as StubElement;
    const toastContainer = doc.createElement('div');
    wireProviderSection(section as never, asHTMLElement(toastContainer));
    const testBtn = findEl(section, '[data-role="provider-test"]');
    testBtn.dispatchEvent('click');
    await vi.waitFor(() => {
      const select = findEl(section, '[data-role="provider-model"]');
      const values = select.children
        .filter((c) => c.tagName === 'option')
        .map((o) => o.getAttribute('value'));
      expect(values).toEqual(['claude-opus-4-7', 'claude-sonnet-4-6']);
    });
    const toasts = toastContainer.children.filter((c) =>
      c.className.includes('toast--success'),
    );
    expect(toasts.length).toBe(1);
  });

  it('on failure: shows an error toast and does not change the dropdown', async () => {
    setSecret('anthropicApiKey', API_KEY);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      errorResponse('Invalid API key', 401),
    );
    const doc = makeDoc();
    const state = await loadProviderState();
    const section = buildProviderSection(
      state,
      asDocument(doc),
    ) as unknown as StubElement;
    const toastContainer = doc.createElement('div');
    wireProviderSection(section as never, asHTMLElement(toastContainer));
    const select = findEl(section, '[data-role="provider-model"]');
    const beforeValues = select.children
      .filter((c) => c.tagName === 'option')
      .map((o) => o.getAttribute('value'));
    const testBtn = findEl(section, '[data-role="provider-test"]');
    testBtn.dispatchEvent('click');
    await vi.waitFor(() => {
      const toasts = toastContainer.children.filter((c) =>
        c.className.includes('toast--error'),
      );
      expect(toasts.length).toBe(1);
    });
    const afterValues = select.children
      .filter((c) => c.tagName === 'option')
      .map((o) => o.getAttribute('value'));
    expect(afterValues).toEqual(beforeValues);
  });

  it('on empty key: shows an error toast without an API call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const doc = makeDoc();
    const state = await loadProviderState();
    const section = buildProviderSection(
      state,
      asDocument(doc),
    ) as unknown as StubElement;
    const toastContainer = doc.createElement('div');
    wireProviderSection(section as never, asHTMLElement(toastContainer));
    const testBtn = findEl(section, '[data-role="provider-test"]');
    testBtn.dispatchEvent('click');
    await vi.waitFor(() => {
      const toasts = toastContainer.children.filter((c) =>
        c.className.includes('toast--error'),
      );
      expect(toasts.length).toBe(1);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not leak the API key into the failure toast (no-PII)', async () => {
    setSecret('anthropicApiKey', API_KEY);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      errorResponse(`Upstream issue with key=${API_KEY}`, 400),
    );
    const doc = makeDoc();
    const state = await loadProviderState();
    const section = buildProviderSection(
      state,
      asDocument(doc),
    ) as unknown as StubElement;
    const toastContainer = doc.createElement('div');
    wireProviderSection(section as never, asHTMLElement(toastContainer));
    const testBtn = findEl(section, '[data-role="provider-test"]');
    testBtn.dispatchEvent('click');
    await vi.waitFor(() => {
      const toasts = toastContainer.children.filter((c) =>
        c.className.includes('toast--error'),
      );
      expect(toasts.length).toBe(1);
      expect(toasts[0]!.textContent).not.toContain(API_KEY);
    });
  });
});

describe('wireProviderSection — Refresh Models (AC #4)', () => {
  it('clicking Refresh re-fetches and updates the dropdown', async () => {
    setSecret('anthropicApiKey', API_KEY);
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(modelsListResponse(['claude-opus-4-7']));
    const doc = makeDoc();
    const state = await loadProviderState();
    const section = buildProviderSection(
      state,
      asDocument(doc),
    ) as unknown as StubElement;
    const toastContainer = doc.createElement('div');
    wireProviderSection(section as never, asHTMLElement(toastContainer));
    const refresh = findEl(section, '[data-role="provider-refresh"]');
    refresh.dispatchEvent('click');
    await vi.waitFor(() => {
      const select = findEl(section, '[data-role="provider-model"]');
      const values = select.children
        .filter((c) => c.tagName === 'option')
        .map((o) => o.getAttribute('value'));
      expect(values).toEqual(['claude-opus-4-7']);
    });
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('hits the live endpoint (AC #4: real fetch, not just FALLBACK_MODELS)', async () => {
    setSecret('anthropicApiKey', API_KEY);
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        modelsListResponse(['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5']),
      );
    const doc = makeDoc();
    const state = await loadProviderState();
    const section = buildProviderSection(
      state,
      asDocument(doc),
    ) as unknown as StubElement;
    const toastContainer = doc.createElement('div');
    wireProviderSection(section as never, asHTMLElement(toastContainer));
    const refresh = findEl(section, '[data-role="provider-refresh"]');
    refresh.dispatchEvent('click');
    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    // The URL the SDK actually hits must include the models list path.
    const url = fetchSpy.mock.calls[0]![0] as string | URL;
    const urlStr = typeof url === 'string' ? url : url.toString();
    expect(urlStr).toContain('/v1/models');
  });

  it('on empty key: shows error toast without an API call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const doc = makeDoc();
    const state = await loadProviderState();
    const section = buildProviderSection(
      state,
      asDocument(doc),
    ) as unknown as StubElement;
    const toastContainer = doc.createElement('div');
    wireProviderSection(section as never, asHTMLElement(toastContainer));
    const refresh = findEl(section, '[data-role="provider-refresh"]');
    refresh.dispatchEvent('click');
    await vi.waitFor(() => {
      const toasts = toastContainer.children.filter((c) =>
        c.className.includes('toast--error'),
      );
      expect(toasts.length).toBe(1);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('wireProviderSection — model selection persistence', () => {
  it('changing the dropdown persists selectedModel to IDB settings', async () => {
    setSecret('anthropicApiKey', API_KEY);
    const doc = makeDoc();
    const state = await loadProviderState();
    const section = buildProviderSection(
      state,
      asDocument(doc),
    ) as unknown as StubElement;
    const toastContainer = doc.createElement('div');
    wireProviderSection(section as never, asHTMLElement(toastContainer));
    const select = findEl(section, '[data-role="provider-model"]');
    setInputValue(select, 'claude-sonnet-4-6');
    select.dispatchEvent('change');
    await vi.waitFor(async () => {
      expect(await getSetting<string>('selectedModel')).toBe('claude-sonnet-4-6');
    });
  });
});

describe('FALLBACK_MODELS contains Anthropic tiers (AC #3 guard)', () => {
  it('has an Opus, a Sonnet, and a Haiku entry', () => {
    expect(FALLBACK_MODELS.some((m) => m.startsWith('claude-opus'))).toBe(true);
    expect(FALLBACK_MODELS.some((m) => m.startsWith('claude-sonnet'))).toBe(true);
    expect(FALLBACK_MODELS.some((m) => m.startsWith('claude-haiku'))).toBe(true);
  });
});

// Settings UI: AI Provider section (Sprint B / TB.11).
//
// One section per provider concern:
//   * API key field — `type=password` with a show/hide toggle. Persistence
//     model: memory-only via `src/data/secrets.ts`. The key never enters
//     IDB or localStorage. Reload clears it. (Locked by 2026-05-12 Sprint-B
//     audit, finding P2-4.)
//   * Test Connection — calls `fetchAvailableModels(key, {throwOnError})`
//     and shows a success or error toast. On success, populates the model
//     dropdown with the live list.
//   * Model dropdown (<select>) — `selectedModel` (the choice, NOT the
//     key) persists in IDB settings, which is fine because it's not a
//     secret. Seeded with FALLBACK_MODELS while we wait for a successful
//     fetch.
//   * Refresh Models — re-hits the live endpoint. Silent on success
//     (just updates the dropdown); error toast on failure.
//
// XSS posture: every node enters the DOM through `buildElement` (text
// children only — no innerHTML / insertAdjacentHTML). Model IDs are
// emitted as text-node children of `<option>`, so a hostile API response
// could not escape into script context.

import {
  FALLBACK_MODELS,
  fetchAvailableModels,
  getSelectedModel,
} from '../ai/anthropic';
import { setSetting } from '../data/db';
import { clearSecret, getSecret, setSecret } from '../data/secrets';
import { buildElement, type ShellNode } from './dom';
import { showToast } from './toast';

const KEY_SECRET_NAME = 'anthropicApiKey';
const SELECTED_MODEL_SETTING = 'selectedModel';

export interface ProviderState {
  apiKey: string;
  selectedModel: string;
  availableModels: readonly string[];
}

export async function loadProviderState(): Promise<ProviderState> {
  const apiKey = getSecret(KEY_SECRET_NAME) ?? '';
  const selectedModel = await getSelectedModel();
  // Seed the dropdown with FALLBACK_MODELS only when a key is set in
  // memory — otherwise the user has no business choosing a model yet.
  // The user can hit Test Connection or Refresh Models to swap to the
  // live list.
  const availableModels = apiKey.length > 0 ? [...FALLBACK_MODELS] : [];
  return { apiKey, selectedModel, availableModels };
}

function modelOptionsTree(
  available: readonly string[],
  selected: string,
): ShellNode[] {
  const ids = available.length > 0 ? available : [selected];
  return ids.map((id) => {
    const attrs: Record<string, string> = { value: id };
    if (id === selected) attrs.selected = '';
    return { tag: 'option', attrs, children: [id] };
  });
}

export function buildProviderSection(
  state: ProviderState,
  doc: Document = document,
): HTMLElement {
  const tree: ShellNode = {
    tag: 'section',
    className: 'settings__section settings__section--provider',
    children: [
      { tag: 'h3', className: 'settings__heading', children: ['AI Provider'] },
      {
        tag: 'p',
        className: 'settings__hint',
        children: [
          'Your API key is kept in memory only; it never touches storage and is cleared on reload.',
        ],
      },
      {
        tag: 'label',
        className: 'settings__field provider__key-field',
        children: [
          { tag: 'span', className: 'settings__label', children: ['Anthropic API key'] },
          {
            tag: 'div',
            className: 'provider__key-row',
            children: [
              {
                tag: 'input',
                className: 'settings__input provider__key-input',
                attrs: {
                  type: 'password',
                  name: 'anthropicApiKey',
                  autocomplete: 'off',
                  spellcheck: 'false',
                  'aria-label': 'Anthropic API key',
                  value: state.apiKey,
                  'data-role': 'provider-key-input',
                },
              },
              {
                tag: 'button',
                className: 'provider__key-toggle',
                attrs: {
                  type: 'button',
                  'aria-label': 'Show API key',
                  'aria-pressed': 'false',
                  'data-role': 'provider-key-toggle',
                },
                children: ['Show'],
              },
            ],
          },
        ],
      },
      {
        tag: 'div',
        className: 'provider__actions',
        children: [
          {
            tag: 'button',
            className: 'settings__action provider__test',
            attrs: { type: 'button', 'data-role': 'provider-test' },
            children: ['Test connection'],
          },
        ],
      },
      {
        tag: 'label',
        className: 'settings__field provider__model-field',
        children: [
          { tag: 'span', className: 'settings__label', children: ['Model'] },
          {
            tag: 'select',
            className: 'settings__input provider__model',
            attrs: {
              name: 'selectedModel',
              'aria-label': 'Selected Anthropic model',
              'data-role': 'provider-model',
            },
            children: modelOptionsTree(state.availableModels, state.selectedModel),
          },
          {
            tag: 'button',
            className: 'provider__refresh',
            attrs: {
              type: 'button',
              'data-role': 'provider-refresh',
            },
            children: ['Refresh models'],
          },
        ],
      },
    ],
  };
  return buildElement(tree, doc);
}

function readInputValue(el: HTMLInputElement | HTMLSelectElement): string {
  const v = (el as unknown as { value?: unknown }).value;
  if (typeof v === 'string') return v;
  return el.textContent ?? '';
}

function rebuildModelOptions(
  select: HTMLSelectElement,
  models: readonly string[],
  doc: Document,
): void {
  const selected = readInputValue(select);
  const ids =
    models.length > 0
      ? [...models]
      : selected.length > 0
        ? [selected]
        : [];
  const newOptions: HTMLOptionElement[] = ids.map((id) => {
    const opt = doc.createElement('option') as HTMLOptionElement;
    opt.setAttribute('value', id);
    if (id === selected) opt.setAttribute('selected', '');
    opt.appendChild(doc.createTextNode(id));
    return opt;
  });
  // If the prior selection isn't in the new list, fall back to the first
  // option so the dropdown still has a defined value.
  if (!models.includes(selected) && newOptions[0]) {
    newOptions[0].setAttribute('selected', '');
  }
  (select as unknown as {
    replaceChildren: (...nodes: HTMLElement[]) => void;
  }).replaceChildren(...newOptions);
  if (!models.includes(selected) && ids[0]) {
    (select as unknown as { value: string }).value = ids[0];
  }
}

interface ToastSink {
  ownerDocument: Document;
  appendChild(node: HTMLElement): unknown;
}

async function runFetch(
  key: string,
  select: HTMLSelectElement,
  toastContainer: ToastSink,
  doc: Document,
  successMessage: string | null,
): Promise<void> {
  if (key.length === 0) {
    showToast(toastContainer, 'Enter an API key first.', 'error');
    return;
  }
  try {
    const models = await fetchAvailableModels(key, { throwOnError: true });
    rebuildModelOptions(select, models, doc);
    // Persist the (possibly-defaulted) selection so the next session opens
    // on the same choice.
    void setSetting(SELECTED_MODEL_SETTING, readInputValue(select));
    if (successMessage !== null) {
      showToast(toastContainer, successMessage, 'success');
    }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    showToast(toastContainer, `Connection failed: ${raw}`, 'error');
  }
}

function wireKeyInput(section: HTMLElement): HTMLInputElement | null {
  const input = section.querySelector(
    '[data-role="provider-key-input"]',
  ) as HTMLInputElement | null;
  if (input === null) return null;
  const onInput = (): void => {
    const value = readInputValue(input);
    if (value.length === 0) clearSecret(KEY_SECRET_NAME);
    else setSecret(KEY_SECRET_NAME, value);
  };
  input.addEventListener('input', onInput);
  input.addEventListener('change', onInput);
  return input;
}

function wireToggle(section: HTMLElement, input: HTMLInputElement): void {
  const toggle = section.querySelector(
    '[data-role="provider-key-toggle"]',
  ) as HTMLElement | null;
  if (toggle === null) return;
  toggle.addEventListener('click', () => {
    const current = input.getAttribute('type');
    const next = current === 'password' ? 'text' : 'password';
    input.setAttribute('type', next);
    toggle.setAttribute('aria-pressed', next === 'text' ? 'true' : 'false');
    toggle.setAttribute(
      'aria-label',
      next === 'text' ? 'Hide API key' : 'Show API key',
    );
    toggle.textContent = next === 'text' ? 'Hide' : 'Show';
  });
}

function wireModelSelect(section: HTMLElement): HTMLSelectElement | null {
  const select = section.querySelector(
    '[data-role="provider-model"]',
  ) as HTMLSelectElement | null;
  if (select === null) return null;
  select.addEventListener('change', () => {
    void setSetting(SELECTED_MODEL_SETTING, readInputValue(select));
  });
  return select;
}

function wireFetchTriggers(
  section: HTMLElement,
  select: HTMLSelectElement,
  toastContainer: HTMLElement,
): void {
  const doc = section.ownerDocument;
  const test = section.querySelector(
    '[data-role="provider-test"]',
  ) as HTMLElement | null;
  test?.addEventListener('click', () => {
    const key = getSecret(KEY_SECRET_NAME) ?? '';
    void runFetch(key, select, toastContainer, doc, 'Connected.');
  });
  const refresh = section.querySelector(
    '[data-role="provider-refresh"]',
  ) as HTMLElement | null;
  refresh?.addEventListener('click', () => {
    const key = getSecret(KEY_SECRET_NAME) ?? '';
    void runFetch(key, select, toastContainer, doc, null);
  });
}

export function wireProviderSection(
  section: HTMLElement,
  toastContainer: HTMLElement,
): void {
  const input = wireKeyInput(section);
  if (input !== null) wireToggle(section, input);
  const select = wireModelSelect(section);
  if (select !== null) wireFetchTriggers(section, select, toastContainer);
}

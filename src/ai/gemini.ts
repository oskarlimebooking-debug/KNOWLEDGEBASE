// Google Gemini provider (Sprint B / TB.1).
//
// Public surface:
//   * callGeminiAPI(prompt, apiKey, modelOverride?, options?)  → Promise<string>
//   * fetchAvailableModels(apiKey)                              → Promise<string[]>
//   * getSelectedModel()                                        → Promise<string>
//   * FALLBACK_MODELS                                           → readonly string[]
//
// Two invariants this module enforces:
//   1. Errors never echo the API key (the key is in the URL's query string).
//      Both fetch-level errors and API error payloads are redacted before
//      being wrapped in the thrown Error.
//   2. Every request is bounded by an AbortController. By default it fires
//      after 120 s; callers may supply their own AbortSignal to cancel
//      earlier (the two signals are composed).

import { getSetting } from '../data/db';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_TIMEOUT_MS = 120_000;

// Hard-coded fallback used when fetchAvailableModels can't reach the API
// (network failure, non-2xx, malformed body, or empty filtered list).
// Keep in sync with what the Gemini docs list as current public models.
export const FALLBACK_MODELS: readonly string[] = Object.freeze([
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
]);

export interface CallOptions {
  jsonMode?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function getSelectedModel(): Promise<string> {
  const stored = await getSetting<string>('selectedModel');
  return typeof stored === 'string' && stored.length > 0 ? stored : DEFAULT_MODEL;
}

export async function callGeminiAPI(
  prompt: string,
  apiKey: string,
  modelOverride?: string,
  options: CallOptions = {},
): Promise<string> {
  const model = modelOverride ?? (await getSelectedModel());
  const url = buildGenerateContentUrl(model, apiKey);
  const requestBody = JSON.stringify(buildRequestBody(prompt, options));

  const { signal, cleanup } = composeSignal(options);
  try {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
        signal,
      });
    } catch (err) {
      throw wrapTransportError(err, apiKey);
    }
    if (!response.ok) throw await buildHttpError(response, apiKey);
    return await parseSuccessBody(response);
  } finally {
    cleanup();
  }
}

export async function fetchAvailableModels(apiKey: string): Promise<string[]> {
  const url = `${API_BASE}/models?key=${encodeURIComponent(apiKey)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return [...FALLBACK_MODELS];
    const payload = (await response.json()) as unknown;
    const filtered = extractGenerateContentModels(payload);
    return filtered.length > 0 ? filtered : [...FALLBACK_MODELS];
  } catch {
    return [...FALLBACK_MODELS];
  }
}

// --- helpers ---------------------------------------------------------------

function buildGenerateContentUrl(model: string, apiKey: string): string {
  return `${API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

function buildRequestBody(prompt: string, options: CallOptions): Record<string, unknown> {
  const generationConfig: Record<string, unknown> = {};
  if (options.jsonMode) generationConfig['responseMimeType'] = 'application/json';
  if (options.temperature !== undefined) generationConfig['temperature'] = options.temperature;
  if (options.maxOutputTokens !== undefined)
    generationConfig['maxOutputTokens'] = options.maxOutputTokens;

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  };
  if (Object.keys(generationConfig).length > 0) body['generationConfig'] = generationConfig;
  return body;
}

interface ComposedSignal {
  signal: AbortSignal;
  cleanup: () => void;
}

function composeSignal(options: CallOptions): ComposedSignal {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const external = options.signal;
  let externalListener: (() => void) | null = null;
  if (external) {
    if (external.aborted) controller.abort();
    else {
      externalListener = () => controller.abort();
      external.addEventListener('abort', externalListener, { once: true });
    }
  }

  const cleanup = (): void => {
    clearTimeout(timer);
    if (external && externalListener) {
      external.removeEventListener('abort', externalListener);
    }
  };
  return { signal: controller.signal, cleanup };
}

async function buildHttpError(response: Response, apiKey: string): Promise<Error> {
  let detail = '';
  try {
    const payload = (await response.json()) as { error?: { message?: unknown } };
    const message = payload?.error?.message;
    if (typeof message === 'string' && message.length > 0) {
      detail = redact(message, apiKey);
    }
  } catch {
    // body wasn't JSON; status alone carries the signal
  }
  const prefix = `Gemini API error (HTTP ${response.status})`;
  return new Error(detail ? `${prefix}: ${detail}` : prefix);
}

function wrapTransportError(err: unknown, apiKey: string): Error {
  if (err instanceof Error && err.name === 'AbortError') {
    return new Error('Gemini request aborted');
  }
  const raw = err instanceof Error ? err.message : String(err);
  return new Error(`Gemini request failed: ${redact(raw, apiKey)}`);
}

async function parseSuccessBody(response: Response): Promise<string> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Gemini returned a non-JSON response');
  }
  return extractFirstCandidateText(payload);
}

function extractFirstCandidateText(payload: unknown): string {
  const candidates = (payload as { candidates?: unknown })?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error('Gemini response has no candidates');
  }
  const first = candidates[0] as { content?: { parts?: unknown } } | undefined;
  const parts = first?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error('Gemini response candidate has no parts');
  }
  const text = (parts[0] as { text?: unknown })?.text;
  if (typeof text !== 'string') {
    throw new Error('Gemini response candidate part has no text');
  }
  return text;
}

interface GeminiModelMeta {
  name?: string;
  supportedGenerationMethods?: string[];
}

function extractGenerateContentModels(payload: unknown): string[] {
  const models = (payload as { models?: unknown })?.models;
  if (!Array.isArray(models)) return [];
  const out: string[] = [];
  for (const entry of models as GeminiModelMeta[]) {
    const methods = entry?.supportedGenerationMethods;
    const name = entry?.name;
    if (
      Array.isArray(methods) &&
      methods.includes('generateContent') &&
      typeof name === 'string'
    ) {
      const stripped = name.replace(/^models\//, '');
      if (stripped.length > 0) out.push(stripped);
    }
  }
  return out;
}

// Defence in depth: the API key is in the URL's `key=` query param, so a
// transport error or echoed-back error string is the most likely leak vector.
// We replace `key=…` with `key=REDACTED` and, separately, swap any literal
// occurrence of the key value with `REDACTED`.
function redact(message: string, apiKey: string): string {
  let out = message.replace(/key=[^&\s"']+/g, 'key=REDACTED');
  if (apiKey.length > 0) out = out.split(apiKey).join('REDACTED');
  return out;
}

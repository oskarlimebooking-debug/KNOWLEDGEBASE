// Anthropic provider (Sprint B / TB.1).
//
// Public surface (matches the prior Gemini provider so callers don't churn):
//   * callAnthropic(prompt, apiKey, modelOverride?, options?)  → Promise<string>
//   * fetchAvailableModels(apiKey)                              → Promise<string[]>
//   * getSelectedModel()                                        → Promise<string>
//   * FALLBACK_MODELS                                           → readonly string[]
//
// Defaults (per the /claude-api skill):
//   * Model:    `claude-opus-4-7` — never downgrade for cost; user picks via settings.
//   * Thinking: adaptive (`thinking: {type: "adaptive"}`).
//   * Auth:     `x-api-key` HEADER via the SDK — the key never enters a URL,
//               so the leak surface is narrower than Gemini's `?key=` form.
//
// Browser model:
//   The PWA runs in the user's browser; the user enters their own key in the
//   settings modal, kept in memory only via `src/data/secrets.ts`. The SDK's
//   `dangerouslyAllowBrowser` opt-in is appropriate for this personal-use
//   pattern. Do NOT carry this provider into any deployment where the key
//   could be exfiltrated from someone else's device.
//
// Two-layer redaction is preserved as defence in depth for any error path
// that might echo the key (transport errors with `key=…` in URL fragments,
// or a future change that prints the request URL into a log).

import Anthropic from '@anthropic-ai/sdk';

import { getSetting } from '../data/db';

const DEFAULT_MODEL = 'claude-opus-4-7';
const DEFAULT_MAX_TOKENS = 16_000;
const DEFAULT_TIMEOUT_MS = 120_000;

// Hard-coded fallback used when fetchAvailableModels can't reach the API.
// Use only exact model ID strings — never append date suffixes to aliases.
export const FALLBACK_MODELS: readonly string[] = Object.freeze([
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
]);

export interface CallOptions {
  /** Instruct Claude to return JSON. When `jsonSchema` is provided, the
   *  schema is enforced via `output_config.format`. Otherwise we inject a
   *  system-prompt instruction. */
  jsonMode?: boolean;
  jsonSchema?: Record<string, unknown>;
  maxOutputTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Optional system prompt. */
  system?: string;
  /** Adaptive thinking — default `true`. Set `false` for short, non-reasoning
   *  tasks (e.g. classification). */
  thinking?: boolean;
}

export async function getSelectedModel(): Promise<string> {
  const stored = await getSetting<string>('selectedModel');
  return typeof stored === 'string' && stored.length > 0 ? stored : DEFAULT_MODEL;
}

export async function callAnthropic(
  prompt: string,
  apiKey: string,
  modelOverride?: string,
  options: CallOptions = {},
): Promise<string> {
  const model = modelOverride ?? (await getSelectedModel());
  const client = makeClient(apiKey);
  const { signal, cleanup } = composeSignal(options);
  try {
    const params = buildParams(model, prompt, options);
    const message = await client.messages.create(params, { signal });
    return extractText(message);
  } catch (err) {
    throw wrapError(err, apiKey);
  } finally {
    cleanup();
  }
}

export interface FetchModelsOptions {
  /** When true, propagate transport / API errors instead of returning the
   *  hard-coded fallback list. Used by Settings → Test Connection so the
   *  user gets a real success/failure signal; the default (false) preserves
   *  the TB.1 fallback contract for non-interactive callers. */
  throwOnError?: boolean;
}

export async function fetchAvailableModels(
  apiKey: string,
  options: FetchModelsOptions = {},
): Promise<string[]> {
  const client = makeClient(apiKey);
  try {
    const out: string[] = [];
    for await (const m of client.models.list()) {
      if (typeof m.id === 'string' && m.id.length > 0) out.push(m.id);
    }
    if (out.length > 0) return out;
    if (options.throwOnError === true) {
      throw new Error('Anthropic returned an empty model list');
    }
    return [...FALLBACK_MODELS];
  } catch (err) {
    if (options.throwOnError === true) {
      throw err instanceof Error
        ? new Error(redact(err.message, apiKey))
        : new Error(redact(String(err), apiKey));
    }
    return [...FALLBACK_MODELS];
  }
}

// --- helpers ---------------------------------------------------------------

function makeClient(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey,
    // PWA: the key lives in the user's browser session memory; never leaves
    // their device. See module header for the security boundary.
    dangerouslyAllowBrowser: true,
  });
}

function buildParams(
  model: string,
  prompt: string,
  options: CallOptions,
): Anthropic.Messages.MessageCreateParamsNonStreaming {
  const params: Anthropic.Messages.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: options.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }],
  };

  // Adaptive thinking on by default — skill recommends it for "anything
  // remotely complicated", which covers every Sprint-B reading mode.
  if (options.thinking !== false) {
    params.thinking = { type: 'adaptive' };
  }

  // JSON output: prefer strict schema enforcement when a schema is supplied;
  // otherwise instruct via system prompt. Opus 4.7 supports
  // `output_config.format`; the system-prompt path is the universal fallback.
  if (options.jsonSchema !== undefined) {
    params.output_config = {
      format: { type: 'json_schema', schema: options.jsonSchema },
    };
    if (options.system !== undefined) params.system = options.system;
  } else if (options.jsonMode === true) {
    const jsonInstruction = 'Respond with valid JSON only. No preamble, no markdown fences.';
    params.system =
      options.system !== undefined ? `${options.system}\n\n${jsonInstruction}` : jsonInstruction;
  } else if (options.system !== undefined) {
    params.system = options.system;
  }

  return params;
}

function extractText(message: Anthropic.Messages.Message): string {
  const text = message.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  if (text.length === 0) {
    throw new Error('Anthropic response has no text content');
  }
  return text;
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

function wrapError(err: unknown, apiKey: string): Error {
  if (err instanceof Anthropic.APIUserAbortError) {
    return new Error('Anthropic request aborted');
  }
  if (err instanceof Anthropic.APIError) {
    const status = err.status;
    const message = redact(err.message ?? '', apiKey);
    const prefix = `Anthropic API error${status ? ` (HTTP ${status})` : ''}`;
    return new Error(message ? `${prefix}: ${message}` : prefix);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new Error(`Anthropic request failed: ${redact(err.message, apiKey)}`);
  }
  if (err instanceof Error && err.name === 'AbortError') {
    return new Error('Anthropic request aborted');
  }
  const raw = err instanceof Error ? err.message : String(err);
  return new Error(`Anthropic request failed: ${redact(raw, apiKey)}`);
}

// The SDK puts the key in `x-api-key`, not a URL query param, so the
// `key=...` regex sweep mostly defends against accidental URL-logging in
// future code. The literal-key substitution is the load-bearing pass.
function redact(message: string, apiKey: string): string {
  let out = message.replace(/key=[A-Za-z0-9._\-]+/g, 'key=REDACTED');
  if (apiKey.length > 0) out = out.split(apiKey).join('REDACTED');
  return out;
}

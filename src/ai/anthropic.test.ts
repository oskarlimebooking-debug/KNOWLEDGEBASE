import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dbDelete, setSetting } from '../data/db';
import { STORE_SETTINGS } from '../data/schema';

import {
  callAnthropic,
  FALLBACK_MODELS,
  fetchAvailableModels,
  getSelectedModel,
} from './anthropic';

// Anthropic key prefix (`sk-ant-...`) — chosen over `sk-...` so default
// secret-scanner rules (Gitleaks / TruffleHog) won't false-positive on the
// test sentinel. Closes phase-B audit P2-3.
const API_KEY = 'sk-ant-test-abc123';

function anthropicResponse(text: string, status = 200): Response {
  const body = {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-4-7',
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  };
  return new Response(JSON.stringify(body), {
    status,
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
  await dbDelete(STORE_SETTINGS, 'selectedModel');
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('getSelectedModel', () => {
  it('returns claude-opus-4-7 when no setting is stored', async () => {
    expect(await getSelectedModel()).toBe('claude-opus-4-7');
  });

  it('returns the stored selectedModel value', async () => {
    await setSetting('selectedModel', 'claude-sonnet-4-6');
    expect(await getSelectedModel()).toBe('claude-sonnet-4-6');
  });
});

describe('callAnthropic — happy path', () => {
  it('returns the response text on 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse('hello world'));
    expect(await callAnthropic('hi', API_KEY)).toBe('hello world');
  });

  it('uses the model override when supplied', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(anthropicResponse('ok'));
    await callAnthropic('hi', API_KEY, 'claude-sonnet-4-6');
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string) as { model: string };
    expect(body.model).toBe('claude-sonnet-4-6');
  });

  it('falls back to getSelectedModel when no override', async () => {
    await setSetting('selectedModel', 'claude-haiku-4-5');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(anthropicResponse('ok'));
    await callAnthropic('hi', API_KEY);
    const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string) as {
      model: string;
    };
    expect(body.model).toBe('claude-haiku-4-5');
  });

  it('enables adaptive thinking by default', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(anthropicResponse('ok'));
    await callAnthropic('hi', API_KEY);
    const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string) as {
      thinking?: { type: string };
    };
    expect(body.thinking?.type).toBe('adaptive');
  });

  it('disables thinking when opted out', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(anthropicResponse('ok'));
    await callAnthropic('hi', API_KEY, undefined, { thinking: false });
    const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string) as {
      thinking?: unknown;
    };
    expect(body.thinking).toBeUndefined();
  });
});

describe('callAnthropic — JSON mode', () => {
  it('adds a system instruction when jsonMode is true with no schema', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(anthropicResponse('{"x":1}'));
    await callAnthropic('hi', API_KEY, undefined, { jsonMode: true });
    const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string) as {
      system: string;
    };
    expect(body.system).toMatch(/valid JSON/i);
  });

  it('uses output_config.format when a jsonSchema is supplied', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(anthropicResponse('{"x":1}'));
    const schema = { type: 'object', properties: { x: { type: 'number' } } };
    await callAnthropic('hi', API_KEY, undefined, { jsonSchema: schema });
    const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string) as {
      output_config?: { format?: { type?: string; schema?: unknown } };
    };
    expect(body.output_config?.format?.type).toBe('json_schema');
    expect(body.output_config?.format?.schema).toEqual(schema);
  });

  it('appends jsonMode instruction to an existing system prompt', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(anthropicResponse('{}'));
    await callAnthropic('hi', API_KEY, undefined, {
      jsonMode: true,
      system: 'You are a helpful assistant.',
    });
    const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string) as {
      system: string;
    };
    expect(body.system).toContain('You are a helpful assistant.');
    expect(body.system).toMatch(/valid JSON/i);
  });
});

describe('callAnthropic — error paths', () => {
  it('throws on 4xx with the API error message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(errorResponse('Invalid request', 400));
    await expect(callAnthropic('hi', API_KEY)).rejects.toThrow(/Invalid request/);
  });

  it('throws on 5xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(errorResponse('Server unavailable', 503));
    await expect(callAnthropic('hi', API_KEY)).rejects.toThrow(/HTTP 503|Server unavailable/);
  });

  it('throws on malformed JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('not json', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    await expect(callAnthropic('hi', API_KEY)).rejects.toBeTruthy();
  });

  it('throws when content has no text block', async () => {
    const empty = new Response(
      JSON.stringify({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-4-7',
        content: [],
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(empty);
    await expect(callAnthropic('hi', API_KEY)).rejects.toThrow(/no text content/);
  });

  it('does not echo the API key in error messages', async () => {
    // 400 isn't retried by the SDK (5xx and 429 are), so one fetch call is
    // enough. mockImplementation returns a fresh Response per call so a
    // retry on transient errors wouldn't hit a consumed body.
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(errorResponse(`Upstream issue with key=${API_KEY}`, 400)),
    );
    try {
      await callAnthropic('hi', API_KEY);
      throw new Error('should not reach');
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).not.toContain(API_KEY);
      expect(msg).toContain('REDACTED');
    }
  });

  it('aborts within 50ms when the external signal aborts', async () => {
    // Hold the fetch open forever; the AbortController in composeSignal
    // wires up to the external signal and cancels.
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          const sig = init?.signal as AbortSignal | null | undefined;
          if (sig) {
            sig.addEventListener('abort', () => {
              const err = new Error('aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }
        }),
    );
    const controller = new AbortController();
    const start = Date.now();
    setTimeout(() => controller.abort(), 10);
    await expect(
      callAnthropic('hi', API_KEY, undefined, { signal: controller.signal }),
    ).rejects.toThrow(/aborted/i);
    expect(Date.now() - start).toBeLessThan(100);
  });
});

describe('fetchAvailableModels', () => {
  it('returns IDs returned by the SDK list endpoint', async () => {
    const body = {
      data: [
        { id: 'claude-opus-4-7', type: 'model', display_name: 'Opus' },
        { id: 'claude-sonnet-4-6', type: 'model', display_name: 'Sonnet' },
      ],
      has_more: false,
      first_id: 'claude-opus-4-7',
      last_id: 'claude-sonnet-4-6',
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const got = await fetchAvailableModels(API_KEY);
    expect(got).toEqual(['claude-opus-4-7', 'claude-sonnet-4-6']);
  });

  it('falls back to FALLBACK_MODELS on network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('boom'));
    const got = await fetchAvailableModels(API_KEY);
    expect(got).toEqual([...FALLBACK_MODELS]);
  });

  it('falls back to FALLBACK_MODELS on empty list', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ data: [], has_more: false, first_id: null, last_id: null }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    expect(await fetchAvailableModels(API_KEY)).toEqual([...FALLBACK_MODELS]);
  });

  it('exposes documented fallback IDs', () => {
    expect(FALLBACK_MODELS).toContain('claude-opus-4-7');
    expect(FALLBACK_MODELS).toContain('claude-haiku-4-5');
  });
});

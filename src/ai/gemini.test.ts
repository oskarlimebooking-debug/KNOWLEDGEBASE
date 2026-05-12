import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dbDelete, setSetting } from '../data/db';
import { STORE_SETTINGS } from '../data/schema';

import {
  callGeminiAPI,
  FALLBACK_MODELS,
  fetchAvailableModels,
  getSelectedModel,
} from './gemini';

const API_KEY = 'sk-test-abc123';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function happyPayload(text = 'hello world'): unknown {
  return { candidates: [{ content: { parts: [{ text }] } }] };
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
  it('returns gemini-2.5-flash when no setting is stored', async () => {
    expect(await getSelectedModel()).toBe('gemini-2.5-flash');
  });

  it('returns the stored selectedModel value', async () => {
    await setSetting('selectedModel', 'gemini-1.5-pro');
    expect(await getSelectedModel()).toBe('gemini-1.5-pro');
  });
});

describe('callGeminiAPI — happy path', () => {
  it('returns the generated text on 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(happyPayload()));
    expect(await callGeminiAPI('hi', API_KEY)).toBe('hello world');
  });

  it('POSTs to the v1beta generateContent endpoint with model + key', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(happyPayload()));
    await callGeminiAPI('hi', API_KEY, 'gemini-2.5-pro');
    const call = spy.mock.calls[0];
    expect(call).toBeDefined();
    const url = String(call![0]);
    const init = call![1] as RequestInit;
    expect(url).toContain(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent',
    );
    expect(url).toContain(`key=${API_KEY}`);
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(String(init.body)) as {
      contents: Array<{ parts: Array<{ text: string }> }>;
    };
    expect(body.contents[0]!.parts[0]!.text).toBe('hi');
  });

  it('uses getSelectedModel() when no override is supplied', async () => {
    await setSetting('selectedModel', 'gemini-custom-from-setting');
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(happyPayload()));
    await callGeminiAPI('hi', API_KEY);
    const url = String(spy.mock.calls[0]![0]);
    expect(url).toContain('models/gemini-custom-from-setting:generateContent');
  });

  it('jsonMode sets responseMimeType to application/json', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(happyPayload()));
    await callGeminiAPI('hi', API_KEY, 'gemini-2.5-flash', { jsonMode: true });
    const body = JSON.parse(String(spy.mock.calls[0]![1]!.body)) as {
      generationConfig?: { responseMimeType?: string };
    };
    expect(body.generationConfig?.responseMimeType).toBe('application/json');
  });

  it('applies temperature and maxOutputTokens overrides', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(happyPayload()));
    await callGeminiAPI('hi', API_KEY, 'gemini-2.5-flash', {
      temperature: 0.2,
      maxOutputTokens: 256,
    });
    const body = JSON.parse(String(spy.mock.calls[0]![1]!.body)) as {
      generationConfig: { temperature: number; maxOutputTokens: number };
    };
    expect(body.generationConfig.temperature).toBe(0.2);
    expect(body.generationConfig.maxOutputTokens).toBe(256);
  });

  it('omits generationConfig entirely when no overrides are set', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(happyPayload()));
    await callGeminiAPI('hi', API_KEY, 'gemini-2.5-flash');
    const body = JSON.parse(String(spy.mock.calls[0]![1]!.body)) as Record<
      string,
      unknown
    >;
    expect(body['generationConfig']).toBeUndefined();
  });
});

describe('callGeminiAPI — error responses', () => {
  it('throws on 4xx with the API error message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ error: { message: 'API key not valid' } }, 400),
    );
    await expect(callGeminiAPI('hi', API_KEY)).rejects.toThrow(
      /API key not valid/,
    );
  });

  it('throws on 5xx with the API error message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ error: { message: 'Service unavailable' } }, 503),
    );
    await expect(callGeminiAPI('hi', API_KEY)).rejects.toThrow(
      /Service unavailable/,
    );
  });

  it('throws on non-2xx even when the body is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('upstream timeout', { status: 502 }),
    );
    await expect(callGeminiAPI('hi', API_KEY)).rejects.toThrow(/502/);
  });

  it('throws when the 200 response body is not valid JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<<not json>>', { status: 200 }),
    );
    await expect(callGeminiAPI('hi', API_KEY)).rejects.toThrow();
  });

  it('throws when the JSON response is missing candidates', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}));
    await expect(callGeminiAPI('hi', API_KEY)).rejects.toThrow();
  });

  it('throws when the candidate has no text part', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ candidates: [{ content: { parts: [{}] } }] }),
    );
    await expect(callGeminiAPI('hi', API_KEY)).rejects.toThrow();
  });
});

describe('callGeminiAPI — abort + timeout', () => {
  function pendingFetch(): typeof fetch {
    return ((_url: unknown, init: RequestInit | undefined) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          if (signal.aborted) {
            reject(new DOMException('aborted', 'AbortError'));
            return;
          }
          signal.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }
      })) as typeof fetch;
  }

  it('aborts the request after the default 120s timeout', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation(pendingFetch());
    const pending = callGeminiAPI('hi', API_KEY, 'gemini-2.5-flash');
    pending.catch(() => {}); // suppress unhandled rejection
    await vi.advanceTimersByTimeAsync(120_001);
    await expect(pending).rejects.toThrow();
  });

  it('honours options.timeoutMs override', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation(pendingFetch());
    const pending = callGeminiAPI('hi', API_KEY, 'gemini-2.5-flash', {
      timeoutMs: 25,
    });
    pending.catch(() => {});
    await vi.advanceTimersByTimeAsync(50);
    await expect(pending).rejects.toThrow();
  });

  it('aborts in-flight call within 50ms when an external signal fires', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(pendingFetch());
    const controller = new AbortController();
    const pending = callGeminiAPI('hi', API_KEY, 'gemini-2.5-flash', {
      signal: controller.signal,
    });
    pending.catch(() => {});
    const start = Date.now();
    controller.abort();
    let err: unknown;
    try {
      await pending;
    } catch (e) {
      err = e;
    }
    const elapsed = Date.now() - start;
    expect(err).toBeInstanceOf(Error);
    expect(elapsed).toBeLessThan(50);
  });

  it('rejects immediately if an external signal is already aborted', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(pendingFetch());
    const controller = new AbortController();
    controller.abort();
    await expect(
      callGeminiAPI('hi', API_KEY, 'gemini-2.5-flash', {
        signal: controller.signal,
      }),
    ).rejects.toThrow();
  });
});

describe('callGeminiAPI — does not leak the API key', () => {
  it('strips the key from a fetch failure that echoes the URL', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError(
        `fetch failed: GET https://generativelanguage.googleapis.com/v1beta/models/x:generateContent?key=${API_KEY}`,
      ),
    );
    try {
      await callGeminiAPI('hi', API_KEY, 'gemini-2.5-flash');
      expect.unreachable('expected throw');
    } catch (err) {
      expect((err as Error).message).not.toContain(API_KEY);
    }
  });

  it('strips the key from an API error message that contains it', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        { error: { message: `Invalid argument key=${API_KEY}` } },
        400,
      ),
    );
    try {
      await callGeminiAPI('hi', API_KEY, 'gemini-2.5-flash');
      expect.unreachable('expected throw');
    } catch (err) {
      expect((err as Error).message).not.toContain(API_KEY);
    }
  });

  it('does not echo the prompt in error messages (no input PII)', async () => {
    const prompt = 'social security number: 123-45-6789';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ error: { message: 'API key not valid' } }, 400),
    );
    try {
      await callGeminiAPI(prompt, API_KEY, 'gemini-2.5-flash');
      expect.unreachable('expected throw');
    } catch (err) {
      expect((err as Error).message).not.toContain('123-45-6789');
    }
  });
});

describe('fetchAvailableModels', () => {
  it('returns only generateContent-capable model ids, stripping models/ prefix', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        models: [
          {
            name: 'models/gemini-2.5-pro',
            supportedGenerationMethods: ['generateContent', 'countTokens'],
          },
          {
            name: 'models/embed-3',
            supportedGenerationMethods: ['embedContent'],
          },
          {
            name: 'models/gemini-1.5-flash',
            supportedGenerationMethods: ['generateContent'],
          },
        ],
      }),
    );
    expect(await fetchAvailableModels(API_KEY)).toEqual([
      'gemini-2.5-pro',
      'gemini-1.5-flash',
    ]);
  });

  it('falls back to the hard-coded list when fetch rejects', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    expect(await fetchAvailableModels(API_KEY)).toEqual([...FALLBACK_MODELS]);
  });

  it('falls back to the hard-coded list on non-2xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ error: { message: 'bad key' } }, 401),
    );
    expect(await fetchAvailableModels(API_KEY)).toEqual([...FALLBACK_MODELS]);
  });

  it('falls back when the body is not parseable JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<<not json>>'));
    expect(await fetchAvailableModels(API_KEY)).toEqual([...FALLBACK_MODELS]);
  });

  it('falls back when the JSON has no models array', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}));
    expect(await fetchAvailableModels(API_KEY)).toEqual([...FALLBACK_MODELS]);
  });

  it('falls back when the filtered list is empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        models: [
          { name: 'models/embed-3', supportedGenerationMethods: ['embedContent'] },
        ],
      }),
    );
    expect(await fetchAvailableModels(API_KEY)).toEqual([...FALLBACK_MODELS]);
  });

  it('FALLBACK_MODELS includes the default gemini-2.5-flash model', () => {
    expect(FALLBACK_MODELS).toContain('gemini-2.5-flash');
  });
});

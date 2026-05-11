# 33 — Streaming AI & NDJSON Protocol

The Writing Hub's "Generate Draft" feature streams AI tokens into the UI
so the user sees text appear as it's generated, not after a multi-second
wait. This document specifies the protocol, the Vercel route, the client
parser, and how it interacts with cancellation, errors, and back-pressure.

> Implemented in Phase O (`implementation-plan/phase-o-writing-hub.md`).
> Adopted from ThesisCraft's `/api/generate/stream` route with critical
> bug fixes (apiKey propagation, error mid-stream handling) and explicit
> protocol documentation.

---

## Why NDJSON

[NDJSON](https://github.com/ndjson/ndjson-spec) (Newline-Delimited JSON)
is one JSON object per line, separated by `\n`:

```
{"token":"In "}
{"token":"recent "}
{"token":"years, "}
{"token":"the "}
{"token":"concept "}
...
```

Pros over alternatives:
- **Simpler than SSE** (no `event:` / `data:` prefixing, no `\n\n` separators)
- **Trivial client parser** (split on `\n`, JSON.parse each line)
- **Resumable in spirit** (lines are atomic; partial line at end of buffer
  is held until the next read)
- **Robust to errors** (a malformed line can be skipped — others still parse)
- **Wireshark-friendly** (every line is human-readable)

Headway uses the same protocol for any other streaming generation in the
future (e.g. streaming summaries, streaming chapter drafts).

---

## Vercel route

`/api/generate/stream.js` — Node.js runtime (Edge runtime is desirable for
latency but `@google/generative-ai` doesn't fully work there as of writing).

### Request body

```ts
{
  apiKey: string,              // required (Phase O fixes the TC bug where this was missing)
  prompt: string,              // required
  model: string,               // e.g. "gemini-2.0-flash"
  temperature?: number,        // default 0.7
  maxTokens?: number,          // default 8192
}
```

### Response headers

```
Content-Type: application/x-ndjson; charset=utf-8
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

`X-Accel-Buffering: no` disables nginx-level buffering on Vercel's edge
network so tokens flush ASAP. `no-transform` prevents intermediate proxies
from modifying the stream.

### Body protocol

Each line is one of:

```
{"token": "..."}    // one chunk of text from the model
{"done": true}      // sent once at the end of a successful stream
{"error": "..."}    // sent if a recoverable error happens mid-stream
```

The client must:
- Append `token` to the running accumulator
- Treat `done` as a clean-end signal and stop reading
- Treat `error` as a fatal signal and surface to user

### Implementation skeleton

```ts
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({error: 'POST only'}), {status: 405});
  }
  const body = await req.json();
  if (!body.apiKey || !body.prompt) {
    return new Response(JSON.stringify({error: 'Missing apiKey or prompt'}), {status: 400});
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const genAI = new GoogleGenerativeAI(body.apiKey);
        const model = genAI.getGenerativeModel({ model: body.model });
        const result = await model.generateContentStream({
          contents: [{ role: 'user', parts: [{ text: body.prompt }] }],
          generationConfig: {
            temperature: body.temperature ?? 0.7,
            maxOutputTokens: body.maxTokens ?? 8192,
          },
        });

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            controller.enqueue(encoder.encode(JSON.stringify({token: text}) + '\n'));
          }
        }
        controller.enqueue(encoder.encode(JSON.stringify({done: true}) + '\n'));
        controller.close();
      } catch (err: any) {
        try {
          controller.enqueue(encoder.encode(JSON.stringify({error: err.message ?? 'unknown'}) + '\n'));
        } catch { /* connection already torn */ }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
```

---

## Client parser

```ts
const controller = new AbortController();

const res = await fetch('/api/generate/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    apiKey: settings.geminiApiKey,
    prompt,
    model: settings.geminiModel,
    temperature: 0.6,
    maxTokens: Math.min(8192, settings.contextWindow),
  }),
  signal: controller.signal,
});

if (!res.ok) {
  const err = await res.json().catch(() => ({error: 'Stream failed to start'}));
  throw new Error(err.error);
}

const reader = res.body!.getReader();
const decoder = new TextDecoder();
let accumulated = '';
let buffer = '';            // holds partial line across chunks

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });

  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';   // last element may be incomplete

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.token) {
        accumulated += parsed.token;
        setStreamedText(accumulated);    // live preview
      } else if (parsed.error) {
        throw new Error(parsed.error);
      } else if (parsed.done) {
        // graceful end signal
      }
    } catch (err) {
      // Malformed line — log and continue. The model occasionally
      // emits empty or whitespace-only chunks.
      console.warn('NDJSON parse error', line, err);
    }
  }
}

// Flush any remaining buffered partial line
if (buffer.trim()) {
  try {
    const parsed = JSON.parse(buffer.trim());
    if (parsed.token) accumulated += parsed.token;
  } catch { /* discard */ }
}

setAiDraft(accumulated);
setStreamedText('');
```

### Key correctness details

- **Buffer between reads.** The TCP boundary may split a line in two.
  Always carry the last partial line into the next read.
- **Use `decoder.decode(value, { stream: true })`.** Without `stream: true`,
  multi-byte UTF-8 sequences (like emoji or non-ASCII letters) can be
  corrupted at chunk boundaries.
- **Strip lines, not characters.** Splitting on `\n` and trimming the
  resulting strings handles both LF and CRLF line endings.
- **Tolerate malformed lines.** If a line fails to parse, log and continue.
  Aborting the whole stream on one bad chunk is over-strict.

---

## Cancellation

The user clicks "Generate Draft" again, navigates away, or closes the
section. Implementation:

```ts
const abortRef = useRef<AbortController | null>(null);

async function handleGenerateDraft() {
  if (abortRef.current) abortRef.current.abort();
  abortRef.current = new AbortController();
  // ... fetch with signal: abortRef.current.signal
}

useEffect(() => {
  return () => {
    if (abortRef.current) abortRef.current.abort();
  };
}, []);
```

The catch block silently returns on `AbortError`:

```ts
} catch (err: any) {
  if (err.name === 'AbortError') return;
  showToast('Stream failed: ' + err.message, 'error');
}
```

The server side notices the connection drop on the next `controller.enqueue`
and the `for await` loop terminates naturally.

---

## Error handling

| Failure | Where | Behaviour |
|---|---|---|
| Missing apiKey/prompt | Server, before stream starts | 400 JSON response (no NDJSON) |
| Invalid Gemini model | Server, on `getGenerativeModel` | 400 JSON response |
| Gemini 401 / invalid key | Server, on first chunk | NDJSON `{error: "..."}` line, then close |
| Gemini 429 rate limit | Server, on first chunk | NDJSON `{error: "rate limit, try again in N seconds"}` |
| Network drop mid-stream | Client | reader read returns `done`; `accumulated` is preserved |
| User cancellation | Client | AbortError; partial output discarded |
| Malformed NDJSON line | Client | Logged, line skipped, stream continues |

The "preserve partial output on network drop" behaviour is intentional:
the user has likely seen the partial draft on screen; treating an early
disconnect as a hard error would erase what they saw. Save what we have,
toast a soft warning ("connection dropped, partial draft saved").

---

## Back-pressure

For long generations (8K tokens at 100 tokens/sec ≈ 80 seconds), the
client may fall behind the server temporarily. The `ReadableStream` API
handles this transparently: the server's `controller.enqueue` blocks
implicitly when the client hasn't read.

In practice on Vercel's edge network the buffer is large enough that
this is invisible to the user.

---

## Logging and observability

Server-side: each request logs request-id, model, token count, latency
to first token, latency to last token, and any error. These show up in
Vercel function logs.

Client-side: a small per-stream metric is written to local telemetry
(IDB store `telemetry` from Phase G):

```ts
{
  type: 'streaming_generation',
  startedAt, finishedAt, abortedAt?,
  bytesReceived, lineCount, errorCount,
  prompt_length, accumulated_length,
}
```

Useful for diagnosing "the stream cut off" complaints.

---

## Why not Server-Sent Events (SSE)?

SSE works fine but has more boilerplate:
- Each event requires `event:` + `data:` + double-newline framing
- Browsers' `EventSource` API doesn't support custom headers (no apiKey
  in headers)
- The auto-reconnect behaviour of `EventSource` doesn't fit "user-driven
  ad-hoc generation"

NDJSON over `fetch` + `ReadableStream` is simpler and gives explicit
control.

---

## Why not WebSockets?

Overkill for one-way server→client streaming. WebSockets are full-duplex,
require an upgrade handshake, and complicate the static-host story.

---

## Continue reading

- Writing Hub uses this protocol: [`28-writing-hub.md`](28-writing-hub.md)
- Vercel proxy infrastructure: [`21-vercel-proxies.md`](21-vercel-proxies.md)
- AI provider integration: [`16-ai-providers.md`](16-ai-providers.md)

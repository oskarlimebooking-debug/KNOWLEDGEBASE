# 16 — AI Providers (the unified `callAI`)

The app supports **five** AI providers (post-merger; pre-merger had four).
They are abstracted behind a single
`callAI(prompt, apiKey, modelOverride, options)` function so that the
quiz, feed, summary, mind-map, **discovery**, **writing draft**, etc.
generators don't need to know which backend they're talking to.

## Switch (`callAI`)

```js
async function callAI(prompt, apiKey, modelOverride, options) {
  const provider = options?.provider ?? await getSetting('aiProvider') ?? 'gemini';
  switch (provider) {
    case 'merlin':      return callMerlinAPI(prompt, options);
    case 'junia':       return callJuniaAPI(prompt, options);
    case 'docanalyzer': return callDocAnalyzerAPI(prompt, options);
    case 'perplexity':  return callPerplexityAPI(prompt, options);   // NEW Phase K
    case 'gemini':
    default:            return callGeminiAPI(prompt, apiKey, modelOverride, options);
  }
}
```

The `options.provider` override allows individual call sites (e.g. the
Discovery pipeline) to force a specific provider regardless of the user's
default. Phase L's Discovery uses `provider: 'perplexity'` for Step 2
and `provider: 'gemini'` for Steps 1 and 3. Phase O's Writing Hub uses
the user's default provider.

`hasAnyAIProvider()` (`index.html:10871`) is the gate that prevents the
batch importer from running if no provider is configured.

## 1. Google Gemini (`callGeminiAPI`)

`index.html:10512`. The reference provider.

```js
POST https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}
Content-Type: application/json

{
  "contents": [ { "parts": [ { "text": "<prompt>" } ] } ],
  "generationConfig": {
    "temperature": 0.7,
    "maxOutputTokens": 65536,
    "responseMimeType": "application/json"   // optional, JSON mode
  }
}
```

- Default timeout: 120 s (`AbortController`).
- `options.jsonMode = true` enables strict JSON output (saves us from
  `"```json"` cleanup).
- `options.maxOutputTokens` and `options.temperature` overrides allowed.
- Response: `data.candidates[0].content.parts[0].text`.

Models discovery: `fetchAvailableModels(apiKey)` calls
`GET /v1beta/models?key=...` and filters to those supporting
`generateContent`. Falls back to a hard-coded list if discovery fails:
`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash`.

## 2. Merlin AI (`callMerlinAPI`)

`index.html:10651`. Merlin is a third-party AI hub that grants access to
multiple models (Gemini 3, Claude Sonnet, GPT-4o, etc.) under one auth.
Authentication uses Firebase Identity Toolkit:

### Auth flow

```
authenticateMerlin(email, password)
  → POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=<MERLIN_FIREBASE_API_KEY>
  → { idToken, refreshToken, expiresIn, ... }
  → store all three + email in IDB

getMerlinToken()
  → if not expired (with 60s margin): return cached idToken
  → else: refreshMerlinToken()

refreshMerlinToken()
  → POST https://securetoken.googleapis.com/v1/token?key=<MERLIN_FIREBASE_API_KEY>
     body: grant_type=refresh_token&refresh_token=<...>
  → store new idToken + refreshToken + expiry
```

`MERLIN_FIREBASE_API_KEY = 'AIzaSyAvCgtQ4XbmlQGIynDT-v_M8eLaXrKmtiM'` — this
is Merlin's public Firebase key, hardcoded in the file.

### Chat endpoint

```
POST https://www.getmerlin.in/arcane/api/v2/thread/unified
Authorization: Bearer <idToken>
Content-Type: application/json
Accept: text/event-stream
x-merlin-version: web-merlin
x-request-timestamp: 2024-01-15T12:34:56.789+02:00[Europe/Stockholm]

{
  "attachments": [],
  "chatId": "<uuid>",
  "language": "AUTO",
  "message": { "id": "<uuid>", "childId": "<uuid>", "parentId": "<uuid>",
               "content": "<prompt>", "context": "" },
  "mode": "UNIFIED_CHAT",
  "model": "gemini-3.0-flash",
  "metadata": {
    "noTask": true,
    "isWebpageChat": false,
    "deepResearch": false,
    "webAccess": true,
    "proFinderMode": false,
    "mcpConfig": { "isEnabled": false },
    "merlinMagic": false
  }
}
```

### SSE parser

The response is an event-stream with `data: {...}` lines:

```js
const reader = resp.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
let fullResponse = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop();
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const parsed = JSON.parse(line.substring(6).trim());
    // Skip reasoning / progress events
    if (parsed.data?.type === 'text' && parsed.data.text) {
      fullResponse += parsed.data.text;
    }
    if (parsed.status === 'system' && parsed.data?.eventType === 'DONE') break;
  }
}
return fullResponse;
```

### Image attachments

`callMerlinAPIWithImage(prompt, base64Image, options)` adds:

```js
attachments: [{ type: 'image', data: 'data:image/jpeg;base64,...', name: 'page.jpg' }]
```

Used by the AI-OCR Merlin path (see [`05-ocr-and-extraction.md`](05-ocr-and-extraction.md)).

### Custom UUID

`generateUUID()` (`index.html:10644`) is a v4 generator. Used for
`chatId`, `msgId`, `childId`, `parentId`.

## 3. Junia AI (`callJuniaAPI`)

`index.html:10825`. Simpler bearer-token auth.

```
POST https://www.junia.ai/api/ai-chat
Authorization: Bearer <token>
Content-Type: application/json
x-api-client-version: 0

{
  "messages": [{ "role": "user", "content": "<prompt>", "createdAt": "<iso>" }],
  "features": { "gpt4": true },
  "style": "",
  "sourceIds": [],
  "persona": "ai-assistant",
  "creativityLevel": "Medium"
}
```

The response is plain text streamed back. The server appends a trailing
UUID fragment that the parser strips with a regex:

```js
const uuidMatch = text.match(/([a-f0-9]{8}-[a-f0-9]{4})$/);
if (uuidMatch) text = text.substring(0, uuidMatch.index);
```

Settings: `juniaCreativity` (Low/Medium/High), `juniaPersona`,
`juniaGpt4` (boolean).

## 4. DocAnalyzer.ai (`callDocAnalyzerAPI`)

`index.html:11231`. Different shape: this is a **document-grounded chat**
service. It needs an uploaded document before it can answer questions
against it.

### Endpoints used (via `/api/docanalyzer/proxy`)

- `POST documents` — multipart file upload, returns `{ id, filename, status }`.
- `POST chat` — `{ document_id, question, model, adherence }` →
  `{ answer }`.
- `DELETE documents/<id>` — cleanup.

### Adherence

`adherence` is a DocAnalyzer-specific tunable: `strict | balanced |
creative`. Higher creativity lets the model extrapolate beyond the
document.

### `callDocAnalyzerAPI` flow

```
1. Try to detect a content block in the prompt using regex markers
   ("Here is the chapter:", "Content:", code fences).
2. If found:
   - Upload the content as a doc.
   - Wait 2s for indexing.
   - Ask the question via /chat.
   - Delete the doc after.
3. If short prompt and no content block:
   - Upload a placeholder doc.
   - Ask the question directly.
4. If long prompt and no content block:
   - Use the entire prompt as content.
```

This makes DocAnalyzer act like a normal LLM for our prompts, at the cost
of an upload-chat-delete round trip per call.

## 5. Perplexity Sonar (`callPerplexityAPI`) — NEW Phase K

The retrieval-augmented generation provider used by the Discovery
pipeline (Phase L) for academic article search.

```
POST /api/perplexity/proxy
Body: {
  apiKey,
  model: 'sonar',
  messages: [
    { role: 'system', content: 'You are an academic research assistant. Return JSON arrays of real published articles...' },
    { role: 'user', content: query + (existingTitles ? '\nAvoid these titles: ' + existingTitles.join(', ') : '') }
  ],
  temperature: 0.2
}
```

The proxy forwards to `https://api.perplexity.ai/chat/completions`. The
client applies three JSON-extraction strategies in order (see
[`27-discovery-module.md`](27-discovery-module.md)).

Used **only** for retrieval; not for generic generation. The other
providers (Gemini, Merlin, Junia) handle the rest of the app.

## Vercel proxy why

Vadoo, DocAnalyzer, and Perplexity all have CORS restrictions. The
three `/api/*` serverless functions add `Access-Control-Allow-Origin: *`
and forward the request server-side. See
[`21-vercel-proxies.md`](21-vercel-proxies.md).

## Adding a new provider

A new provider needs:

1. A `call<Provider>API(prompt, options)` function.
2. A case in the `callAI` switch.
3. A settings UI section + setting key for the API key.
4. A check in `hasAnyAIProvider()`.
5. Sync key in the `syncableSettingKeys` list of `getSyncDataForUpload`
   so the API key syncs across devices.

A rebuild would generalize this into a registry pattern (provider
plugins in their own modules with a common interface). See
[`25-rebuild-blueprint.md`](25-rebuild-blueprint.md).

Continue to [`17-drive-sync.md`](17-drive-sync.md).

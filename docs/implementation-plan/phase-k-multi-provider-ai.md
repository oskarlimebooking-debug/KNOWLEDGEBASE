# Phase K — Multi-Provider AI + Perplexity

> **Tagline:** Let users bring their own AI key — Merlin, Junia, DocAnalyzer, **Perplexity**.

## Goal

Abstract Phase B's Gemini-only `callGeminiAPI` behind a unified
`callAI` interface, then add **four** additional providers: Merlin AI
(Firebase auth + SSE streaming), Junia AI (bearer token),
DocAnalyzer.ai (upload-then-chat document model), and **Perplexity Sonar**
(academic web search via JSON extraction). Add Vercel serverless proxies
for the providers that lack CORS.

Phase K (post-merger) is the foundation that Phase L (Discovery) builds
on — Discovery's 3-step pipeline uses Perplexity for retrieval.

## Why this phase / rationale

Different users want different providers:
- Some have Merlin subscriptions and access to GPT-4o, Claude, etc.
- Some prefer Junia for its persona system.
- Some have DocAnalyzer for grounded chat against their library.

Gemini alone is sufficient to ship the app, but locking users to one
provider closes a door. Doing this work now, before the deeper feature
phases, means everything downstream automatically benefits from
multiple providers.

## Prerequisites

- Phase B (Gemini provider exists).
- Phase F (settings sync — provider tokens must be syncable).

## Deliverables

- `callAI(prompt, apiKey, modelOverride, options)` — unified entry
  point that dispatches based on `aiProvider` setting.
- Merlin AI provider (Firebase email/password auth, SSE streaming
  chat, image attachments).
- Junia AI provider (bearer token chat with persona / creativity).
- DocAnalyzer provider (upload doc → chat → delete).
- **Perplexity Sonar provider** (`callAI(...)` with `provider:
  'perplexity'` returns search-augmented JSON; supports the three
  JSON-extraction strategies from ThesisCraft's `/api/search` route).
- **Three** Vercel serverless functions: `/api/vadoo/proxy`,
  `/api/docanalyzer/proxy`, **`/api/perplexity/proxy`**.

## Tasks added vs pre-merger

- **K-Perplexity-1**: Implement Perplexity provider in
  `src/providers/ai/perplexity.ts`. Sends `model: 'sonar'`,
  `temperature: 0.2`. Forwards through `/api/perplexity/proxy`.
- **K-Perplexity-2**: Three JSON extraction strategies (port from TC):
  direct `JSON.parse`, markdown code-fence regex, first `[...]` block
  regex. Each item validated.
- **K-Perplexity-3**: `validateResult()` coerces types, drops items
  without `title`.
- **K-Perplexity-4**: Settings: `perplexityApiKey`. Add to API Keys
  panel.
- **K-Perplexity-5**: Vercel proxy `/api/perplexity/proxy.ts` — POST
  body forwards to Perplexity, includes apiKey from body, no key
  storage server-side.
- Settings UI sections per provider with auth flow.
- `hasAnyAIProvider()` gate before any AI-dependent action.

## Task breakdown

### H1 — Refactor to `callAI`

Replace direct `callGeminiAPI` calls with `callAI` everywhere except
inside `callGeminiAPI` itself.

```js
async function callAI(prompt, apiKey, modelOverride, options) {
  const provider = await getSetting('aiProvider') || 'gemini';
  switch (provider) {
    case 'merlin':      return callMerlinAPI(prompt, options);
    case 'junia':       return callJuniaAPI(prompt, options);
    case 'docanalyzer': return callDocAnalyzerAPI(prompt, options);
    case 'gemini':
    default:            return callGeminiAPI(prompt, apiKey, modelOverride, options);
  }
}
```

Add `hasAnyAIProvider()`:
```js
async function hasAnyAIProvider() {
  const provider = await getSetting('aiProvider') || 'gemini';
  if (provider === 'merlin')      return !!(await getSetting('merlinIdToken'));
  if (provider === 'junia')       return !!(await getSetting('juniaToken'));
  if (provider === 'docanalyzer') return !!(await getSetting('docanalyzerApiKey'));
  return !!(await getSetting('apiKey'));
}
```

### H2 — Merlin: Firebase auth flow

`MERLIN_FIREBASE_API_KEY = 'AIzaSyAvCgtQ4XbmlQGIynDT-v_M8eLaXrKmtiM'`
(public Firebase key for Merlin's project).

```js
async function authenticateMerlin(email, password) {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${MERLIN_FIREBASE_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }) });
  const data = await r.json();
  if (data.error) throw new Error(data.error.message);
  await setSetting('merlinIdToken', data.idToken);
  await setSetting('merlinRefreshToken', data.refreshToken);
  await setSetting('merlinTokenExpiry', Date.now() + parseInt(data.expiresIn) * 1000);
  await setSetting('merlinEmail', email);
}
```

`refreshMerlinToken()`:
```js
fetch(`https://securetoken.googleapis.com/v1/token?key=${MERLIN_FIREBASE_API_KEY}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `grant_type=refresh_token&refresh_token=${refreshToken}`
});
```

`getMerlinToken()` — return cached token if not expired (60s margin),
else refresh.

### H3 — Merlin: SSE chat

```
POST https://www.getmerlin.in/arcane/api/v2/thread/unified
Authorization: Bearer <idToken>
Content-Type: application/json
Accept: text/event-stream
x-merlin-version: web-merlin
x-request-timestamp: <ISO with timezone>
```

Body (every field is required):
```jsonc
{
  "attachments": [],
  "chatId": "<uuid>",
  "language": "AUTO",
  "message": { "id": "<uuid>", "childId": "<uuid>", "parentId": "<uuid>",
               "content": "<prompt>", "context": "" },
  "mode": "UNIFIED_CHAT",
  "model": "gemini-3.0-flash",
  "metadata": { "noTask": true, "isWebpageChat": false,
                "deepResearch": false, "webAccess": true,
                "proFinderMode": false,
                "mcpConfig": { "isEnabled": false },
                "merlinMagic": false }
}
```

SSE parser:
```js
const reader = resp.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
let result = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop();
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const obj = JSON.parse(line.substring(6).trim());
    if (obj.status === 'system' && obj.data?.eventType === 'DONE') return result;
    if (obj.data?.type === 'text' && obj.data.text) {
      result += obj.data.text;
      options.onToken?.(obj.data.text);  // for streaming UI in chat modes
    }
  }
}
```

`generateUUID()` — v4 generator.

`getMerlinTimestamp()` — formatted with timezone bracket like
`2024-01-15T12:34:56.789+02:00[Europe/Stockholm]`.

### H4 — Merlin: image attachments

`callMerlinAPIWithImage(prompt, base64Image, options)`:

```jsonc
"attachments": [
  { "type": "image",
    "data": "data:image/jpeg;base64,...",
    "name": "page.jpg" }
]
```

Used by the Phase I AI-OCR Merlin path.

### H5 — Junia AI

```
POST https://www.junia.ai/api/ai-chat
Authorization: Bearer <token>
Content-Type: application/json
x-api-client-version: 0
```

```jsonc
{
  "messages": [{ "role": "user", "content": "<prompt>",
                 "createdAt": "<iso>" }],
  "features": { "gpt4": true },
  "style": "",
  "sourceIds": [],
  "persona": "ai-assistant",
  "creativityLevel": "Medium"
}
```

Response is plain text with a trailing UUID fragment that must be
stripped:
```js
const uuidMatch = text.match(/([a-f0-9]{8}-[a-f0-9]{4})$/);
if (uuidMatch) text = text.substring(0, uuidMatch.index);
```

Settings:
- `juniaToken`
- `juniaCreativity` (`Low`, `Medium`, `High`)
- `juniaPersona`
- `juniaGpt4` (boolean)

### H6 — DocAnalyzer (proxied)

Endpoints (all via `/api/docanalyzer/proxy`):
- `POST documents` — multipart upload → `{ id, filename, status }`.
- `POST chat` — `{ document_id, question, model, adherence }` →
  `{ answer }`.
- `DELETE documents/<id>` — cleanup.

`callDocAnalyzerAPI(prompt, options)`:
1. Try to detect a content block in the prompt using regex markers
   ("Here is the chapter:", "Content:", code fences).
2. Upload the content as a doc.
3. Wait 2s for indexing.
4. Ask the question via /chat.
5. Delete the doc.

Settings:
- `docanalyzerApiKey`
- `docanalyzerModel` (`gpt-4o`, etc.)
- `docanalyzerAdherence` (`strict`, `balanced`, `creative`)

### H7 — Vercel proxy: DocAnalyzer

`api/docanalyzer/proxy.js`:

- CORS headers: `*`.
- Accept GET, POST, DELETE, OPTIONS.
- Read `X-DocAnalyzer-Path` (or `?path=` query) for the API path.
- Forward `Authorization` header.
- Multipart support via `formdata-node` for file uploads.
- Forward to `https://api.docanalyzer.ai/api/v1/<path>`.

### H8 — Vercel proxy: Vadoo (preview, used in Phase K)

Same pattern, simpler. `api/vadoo/proxy.js`:
- Read `X-Vadoo-Endpoint` (or `?endpoint=`).
- Forward `X-Api-Key` header.
- Forward to `https://aiapi.vadoo.tv/api/<endpoint>`.

(Even though Vadoo isn't used until Phase K, deploying both proxies
in this phase keeps the proxy infrastructure together.)

### H9 — Service worker pass-through

Update the SW's API allowlist:
```
generativelanguage.googleapis.com
api.lazybird.app
accounts.google.com
oauth2.googleapis.com
apis.google.com
www.googleapis.com/drive
identitytoolkit.googleapis.com
securetoken.googleapis.com
getmerlin.in
junia.ai
api.docanalyzer.ai
aiapi.vadoo.tv
/api/vadoo
/api/docanalyzer
chapterwise-import.json
```

### H10 — Settings UI

`aiProvider` dropdown (`gemini | merlin | junia | docanalyzer`).
`toggleProviderSettings()` shows the right config block.

For Merlin: email/password fields + "Authenticate" button + status.
For Junia: token paste field + persona / creativity / gpt4 controls.
For DocAnalyzer: api key + model + adherence dropdowns.

### H11 — Per-provider sync (extend Phase F whitelist)

Add to `syncableSettingKeys`:
```
aiProvider, merlinIdToken, merlinRefreshToken, merlinTokenExpiry,
merlinEmail, merlinModel, merlinWebAccess, merlinOCRMode,
juniaToken, juniaCreativity, juniaPersona, juniaGpt4,
docanalyzerApiKey, docanalyzerModel, docanalyzerAdherence
```

### H12 — Streaming UI in chat modes

The conversation component (Phase C) already accepts an `onToken`
callback. When the active provider is Merlin, wire `callMerlinAPI` to
emit tokens via `onToken` so the chat UI updates incrementally.

For other providers, post the full response at end-of-call (no
streaming).

## Acceptance criteria

- [ ] All four providers can be selected and used by all generators
      (Summary, Quiz, Flashcards, Feed, Mind Map, Chat).
- [ ] Merlin auth completes with valid credentials.
- [ ] Token auto-refreshes when expired.
- [ ] Junia chat returns clean text (UUID stripped).
- [ ] DocAnalyzer flow uploads, queries, and cleans up the document.
- [ ] Vercel proxies have CORS and forward correctly.
- [ ] Service worker doesn't cache API responses.
- [ ] Streaming works for Merlin in chat modes (visible token-by-token
      rendering).

## Effort estimate

- **T-shirt:** M
- **Person-weeks:** 2–3
- **Critical path:** Merlin SSE parser + DocAnalyzer prompt-block
  detection.

## Risks & unknowns

- **Merlin's API can break.** The `arcane/api/v2/thread/unified`
  endpoint is reverse-engineered from their web client. Treat as
  unstable; if it breaks, fall back to a polite error.
- **Provider parity.** Some prompts (e.g. JSON mode) work differently
  across providers. Add per-prompt smoke tests.
- **DocAnalyzer cost** — every chapter view is a doc upload. Add a
  warning in settings.
- **Hardcoded MERLIN_FIREBASE_API_KEY** — this is Merlin's public key.
  If they rotate it, the auth flow breaks.

## Out of scope

- OpenAI / Claude / Anthropic direct providers (Phase R).
- LiteLLM-style abstraction (Phase R).
- Local LLM via WebLLM / WebGPU (Phase R).
- Custom OAuth2 providers (Phase R).

## Decision points before Phase I

- [ ] Confirm provider list. Adding more later requires only a new
      `call<Name>API` and a switch case.
- [ ] Decide whether to auto-fallback to Gemini if the user's chosen
      provider fails.

---

Continue to [Phase I — Advanced Import & OCR](phase-i-advanced-import.md).

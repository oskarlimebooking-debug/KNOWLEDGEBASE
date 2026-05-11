# 21 — Vercel Serverless Proxies

The browser cannot directly call APIs that lack CORS headers. Several
external services the app uses fall into this category. We work around
it by deploying Vercel serverless functions that act as CORS-permissive
proxies.

These live in:

```
api/
├── docanalyzer/proxy.js          # legacy
├── vadoo/proxy.js                # legacy
├── perplexity/proxy.js           # NEW Phase K — Discovery retrieval
├── lookup/
│   ├── doi.js                    # NEW Phase Q — CrossRef wrapper
│   └── openalex.js               # NEW Phase Q — OpenAlex wrapper
├── generate/
│   ├── stream.js                 # NEW Phase O — NDJSON streaming for Writing Hub
│   └── index.js                  # NEW Phase L — one-shot Gemini wrapper
└── analyze.js                    # NEW Phase L — article relevance analysis
```

Vercel auto-detects the `api/` folder and exposes:

- `https://<project>.vercel.app/api/docanalyzer/proxy`
- `https://<project>.vercel.app/api/vadoo/proxy`
- `https://<project>.vercel.app/api/perplexity/proxy` — NEW
- `https://<project>.vercel.app/api/lookup/doi` — NEW
- `https://<project>.vercel.app/api/lookup/openalex` — NEW
- `https://<project>.vercel.app/api/generate/stream` — NEW (NDJSON; see [`33-streaming-ai-and-ndjson.md`](33-streaming-ai-and-ndjson.md))
- `https://<project>.vercel.app/api/generate` — NEW
- `https://<project>.vercel.app/api/analyze` — NEW

Local dev (`npx serve`) won't run them — use `vercel dev` to test
proxies locally.

## NEW: `/api/perplexity/proxy.js` (Phase K)

Forwards to `https://api.perplexity.ai/chat/completions`. Used by the
Discovery 3-step pipeline (Phase L) for Step 2 (academic article
retrieval).

- Body forwarded as-is, including `apiKey` from request body.
- No key storage server-side.
- Three JSON-extraction strategies applied client-side (see
  [`27-discovery-module.md`](27-discovery-module.md)).

## NEW: `/api/lookup/doi.js` (Phase Q)

Forwards to CrossRef. Returns author list, journal, year, abstract,
volume, issue, pages.

- 7-day cache in `generated` store with `type: 'lookup_doi'`.
- Used at Source creation time and on Discovery import.

## NEW: `/api/lookup/openalex.js` (Phase Q)

Forwards to OpenAlex. Returns concepts, citation count, related works.

- 7-day cache in `generated` store with `type: 'lookup_openalex'`.
- Used to seed `concepts[]` and Phase W's research graph.

## NEW: `/api/generate/stream.js` (Phase O)

Node.js runtime. NDJSON streaming response from Gemini for the Writing
Hub's "Generate Draft" feature. Full protocol spec in
[`33-streaming-ai-and-ndjson.md`](33-streaming-ai-and-ndjson.md).

## NEW: `/api/generate/index.js` (Phase L)

One-shot Gemini wrapper. Used by Discovery Step 1 (query optimization),
Step 3 (relevance analysis), and exercise feedback (Phase P).

## NEW: `/api/analyze.js` (Phase L)

Specialized Gemini wrapper for the relevance analysis prompt — embeds
the active project's hypotheses (or none, in no-project mode) and
returns structured JSON.

## `api/vadoo/proxy.js`

```js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers',
                  'Content-Type, X-Api-Key, X-Vadoo-Endpoint');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const endpoint = req.headers['x-vadoo-endpoint'] || req.query.endpoint;
    const apiKey = req.headers['x-api-key'];
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint parameter' });
    if (!apiKey)  return res.status(400).json({ error: 'Missing X-Api-Key header' });

    const vadooUrl = `https://aiapi.vadoo.tv/api/${endpoint}`;
    const fetchOptions = {
        method: req.method,
        headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' }
    };

    let url = vadooUrl;
    if (req.method === 'GET') {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(req.query)) {
            if (k !== 'endpoint') params.set(k, v);
        }
        const qs = params.toString();
        if (qs) url += `?${qs}`;
    }
    if (req.method === 'POST' && req.body) fetchOptions.body = JSON.stringify(req.body);

    const response = await fetch(url, fetchOptions);
    const data = await response.json();
    return res.status(response.status).json(data);
}
```

### Calling pattern from the client

`vadooFetch(endpoint, { method, params, body })` always hits
`/api/vadoo/proxy?endpoint=<name>` with the API key in `X-Api-Key`. The
proxy unwraps and forwards.

### Endpoints relayed

- `get_my_balance`
- `get_voices`
- `generate_video`
- `get_video_url`

### Why not put the API key in the env?

The user supplies their own Vadoo key in Settings. The app stays
"bring your own credentials" — it never sees the key on the proxy side
beyond forwarding it. The key never leaves the user's browser → Vercel
edge → Vadoo path.

## `api/docanalyzer/proxy.js`

Similar but supports more verbs (GET, POST, DELETE) and multipart upload:

```js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers',
                  'Content-Type, Authorization, X-DocAnalyzer-Path');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const apiPath = req.headers['x-docanalyzer-path'] || req.query.path;
    const authorization = req.headers['authorization'];
    if (!apiPath || !authorization) return res.status(400).json({ error: 'Missing required header' });

    const baseUrl = `https://api.docanalyzer.ai/api/v1/${apiPath}`;
    const fetchOptions = { method: req.method, headers: { 'Authorization': authorization } };

    const contentType = req.headers['content-type'] || '';
    if (req.method === 'POST' || req.method === 'DELETE') {
        if (contentType.includes('multipart/form-data')) {
            // Reconstruct multipart body using formdata-node
            const FormData = (await import('formdata-node')).FormData;
            const form = new FormData();
            for (const [key, value] of Object.entries(req.body || {})) form.append(key, value);
            for (const file of req.files || []) {
                form.append(file.fieldname, new Blob([file.buffer]), file.originalname);
            }
            fetchOptions.body = form;
        } else if (req.body) {
            fetchOptions.headers['Content-Type'] = 'application/json';
            fetchOptions.body = JSON.stringify(req.body);
        }
    }

    let url = baseUrl;
    if (req.method === 'GET') {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(req.query)) {
            if (k !== 'path') params.set(k, v);
        }
        const qs = params.toString();
        if (qs) url += `?${qs}`;
    }

    const response = await fetch(url, fetchOptions);
    const data = await response.json();
    return res.status(response.status).json(data);
}
```

The `path` is forwarded via `X-DocAnalyzer-Path` (or the `path` query
param) so the proxy can reach any endpoint under
`https://api.docanalyzer.ai/api/v1/`.

### Endpoints used

- `documents` (POST multipart) — upload
- `chat` (POST JSON) — query
- `documents/<id>` (DELETE) — cleanup

## Why is the SW pass-through allow-listed for both?

Look at `sw.js`:

```js
event.request.url.includes('/api/vadoo') ||
event.request.url.includes('/api/docanalyzer')
```

This ensures the proxy responses are **never cached** — they're dynamic
API calls that need fresh round trips.

## Cost considerations

Vercel's hobby tier gives you 100K serverless function executions per
month, which is plenty for a single user. Heavy use of Vadoo (which
polls every 15 s) can rack up several hundred executions per video.

A rebuild that wants to be cost-conscious could:

- Move polling to the client and forward only completion via a webhook.
- Use Cloudflare Workers (cheaper) instead of Vercel.
- Or do polling via a tiny Cloud Function that the client sleeps on a
  WebSocket for.

## Why two functions, not one?

Each function handler is isolated and wraps its own service-specific
quirks (Vadoo's `endpoint` header vs DocAnalyzer's path-based routing,
multipart for DocAnalyzer). Combining them would mean a switch on
`req.query.target` and weaker safety. The duplication is intentional.

## Adding a new proxy

```
api/<servicename>/proxy.js
```

Vercel will auto-route. Don't forget to:

1. Add the URL to the SW's pass-through allowlist (`sw.js`).
2. Add a wrapper client function in `index.html` (e.g. `<service>Fetch`).
3. Add the API key to the Drive sync allowlist if you want it to sync.

Continue to [`22-import-file-format.md`](22-import-file-format.md).

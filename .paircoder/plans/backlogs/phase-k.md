# Sprint K: Multi-Provider AI + Perplexity — Merlin, Junia, DocAnalyzer, Sonar

> One task per T-item in `docs/implementation-plan/phase-k-multi-provider-ai.md` (H1–H5 + K-Perplexity-1..5 in the source doc).
> Abstract `callGeminiAPI` behind unified `callAI`. Add Merlin (Firebase + SSE), Junia (bearer), DocAnalyzer (upload-then-chat), and Perplexity Sonar. Three Vercel proxies.

### Phase 1: Refactor + Merlin

### TK.1 -- callAI dispatcher + hasAnyAIProvider gate | Cx: 8 | P0

**Description:** Replace direct `callGeminiAPI` everywhere except inside Gemini provider. `callAI(prompt, apiKey, modelOverride, options)` switches by `getSetting('aiProvider')` → merlin/junia/docanalyzer/perplexity/gemini. `hasAnyAIProvider()` checks provider-specific token.

**AC:**
- [ ] No direct `callGeminiAPI` call sites in app code (only inside provider)
- [ ] `hasAnyAIProvider()` covers all 5 providers
- [ ] Vitest: each provider path exercised
- [ ] AI gate prevents calls when no provider configured

**Depends on:** TG.6, TB.1

### TK.2 -- Merlin Firebase auth | Cx: 8 | P1

**Description:** `MERLIN_FIREBASE_API_KEY` constant. `authenticateMerlin(email, password)` → POST `identitytoolkit.googleapis.com/v1/accounts:signInWithPassword`. Store `merlinIdToken`, `merlinRefreshToken`, `merlinTokenExpiry`, `merlinEmail`. `refreshMerlinToken()` via `securetoken.googleapis.com/v1/token`. `getMerlinToken()` returns cached or refreshed.

**AC:**
- [ ] Login persists tokens in IDB (not localStorage)
- [ ] Refresh fires within 60s of expiry
- [ ] Failed login surfaces user-friendly error
- [ ] Vitest mocks Firebase endpoints

**Depends on:** TK.1

### TK.3 -- Merlin SSE chat | Cx: 13 | P1

**Description:** POST `getmerlin.in/arcane/api/v2/thread/unified` with full payload (attachments, chatId, language, message, mode, model, metadata). SSE parser: reader + decoder, `data:` lines, JSON parse, accumulate text via `options.onToken`. `generateUUID()` v4. `getMerlinTimestamp()` with timezone bracket.

**AC:**
- [ ] SSE stream parsed correctly; tokens delivered to callback
- [ ] DONE event terminates stream cleanly
- [ ] Error events surface to caller
- [ ] Stream works with conversation component (sprint C)

**Depends on:** TK.2

### TK.4 -- Merlin image attachments | Cx: 5 | P2

**Description:** `callMerlinAPIWithImage(prompt, base64Image, options)` builds attachments array `[{ type: 'image', data: 'data:image/jpeg;base64,...', name }]`. Used by Phase M AI-OCR Merlin path.

**AC:**
- [ ] Image payload accepted by API
- [ ] Round-trip fixture verified
- [ ] Falls back gracefully on non-image responses

**Depends on:** TK.3

### Phase 2: Junia + DocAnalyzer

### TK.5 -- Junia AI provider | Cx: 8 | P1

**Description:** POST `junia.ai/api/ai-chat` with `Authorization: Bearer <token>`, `x-api-client-version: 0`. Persona + creativity options. Settings: `juniaToken`.

**AC:**
- [ ] Chat works end-to-end
- [ ] Persona option flows into prompt
- [ ] Token persisted in IDB
- [ ] Error handling parity with Gemini

**Depends on:** TK.1

### TK.6 -- DocAnalyzer provider (upload-then-chat) | Cx: 13 | P1

**Description:** Upload doc → poll → chat against grounded doc → delete. Vercel proxy `/api/docanalyzer/proxy` because DocAnalyzer lacks CORS. Settings: `docanalyzerApiKey`.

**AC:**
- [ ] Upload + chat + delete flow works end-to-end
- [ ] Polling backs off cleanly
- [ ] Proxy passes through key from body (no server-side storage)
- [ ] Error UX clear when doc lookup fails

**Depends on:** TK.1, TK.7

### Phase 3: Perplexity Sonar

### TK.7 -- Perplexity Sonar provider | Cx: 8 | P0

**Description:** `src/providers/ai/perplexity.ts`. Sends `model: 'sonar'`, `temperature: 0.2`. Forwards through `/api/perplexity/proxy`.

**AC:**
- [ ] Provider integrates with `callAI` dispatch
- [ ] Sonar response parsed cleanly
- [ ] Settings: `perplexityApiKey`
- [ ] Vitest covers happy + edge cases

**Depends on:** TK.1, TK.8

### TK.8 -- Three Perplexity JSON extraction strategies | Cx: 8 | P0

**Description:** Port from ThesisCraft: (1) direct `JSON.parse`, (2) markdown code-fence regex, (3) first `[...]` block regex. Each item validated via `validateResult()` which coerces types and drops items without `title`.

**AC:**
- [ ] All 3 strategies covered
- [ ] Fixture malformed responses all repair successfully
- [ ] `validateResult` schema documented
- [ ] Vitest fuzzes 20+ malformed inputs

**Depends on:** TK.7

### TK.9 -- Vercel proxy /api/perplexity/proxy | Cx: 5 | P0

**Description:** POST body forwards to Perplexity, includes `apiKey` from body, no server-side key storage. Edge runtime.

**AC:**
- [ ] Proxy deploys cleanly on Vercel
- [ ] No keys logged or persisted server-side
- [ ] CORS preflight handled
- [ ] Rate-limit awareness in error responses

**Depends on:** TK.7

### TK.10 -- Vercel proxies (Vadoo + DocAnalyzer) | Cx: 5 | P1

**Description:** `/api/vadoo/proxy` (for Sprint R video) and `/api/docanalyzer/proxy` (DocAnalyzer flow).

**AC:**
- [ ] Both proxies deploy
- [ ] Same key-passthrough policy as TK.9
- [ ] CORS preflight handled
- [ ] Vadoo proxy stub returns 501 until Sprint R wires it

**Depends on:** TK.9

### TK.11 -- Settings: provider switcher + auth UI | Cx: 8 | P1

**Description:** Settings UI sections per provider with auth flow. Selector to set `aiProvider`. Status indicator per provider.

**AC:**
- [ ] All 5 providers configurable
- [ ] Active provider clearly indicated
- [ ] Test-connection per provider
- [ ] Auth flow respects iOS-Safari user-gesture for Merlin (popup) if any

**Depends on:** TK.2, TK.5, TK.6, TK.7

---

## Sprint enforcement gates (must pass before Sprint L begins)

- [ ] **G-AC** — all task AC ticked
- [ ] **G-Security** — proxies don't log or persist API keys
- [ ] **G-Tests** — Perplexity 3-strategy parser ≥ 90% coverage
- [ ] **G-Manual** — Real-device login on Merlin works
- [ ] **G-State** — `state.md` updated

**Decision points before Sprint L:**

- [ ] Dual-write sync envelope (sprint I) — can we remove now? (Recommended: keep through L for safety)
- [ ] Default provider for new users (gemini stays default)

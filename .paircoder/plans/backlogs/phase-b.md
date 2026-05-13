# Sprint B: AI Core & Basic Learning — Gemini, Summary, Quiz, Flashcards, Teach-Back

> One task per T-item in `docs/implementation-plan/phase-b-ai-core.md`.
> First AI provider (Gemini) + the four foundational learning modes. Cache-first pattern reused by every later AI feature.

### Phase 1: Provider + plumbing

### TB.1 -- Gemini provider (callGeminiAPI) | Cx: 8 | P0

**Description:** `callGeminiAPI(prompt, apiKey, modelOverride, options)` POSTs to `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`. 120s default timeout via AbortController. `options.jsonMode` sets `responseMimeType: 'application/json'`. `options.temperature`, `options.maxOutputTokens` overrides. Throws on non-2xx with the API's error message. `fetchAvailableModels(apiKey)` → list of `generateContent`-capable models with hard-coded fallback list. `getSelectedModel()` reads `selectedModel` (default `gemini-2.5-flash`).

**AC:**
- [ ] Unit tests cover happy path, timeout, 4xx, 5xx, malformed JSON response
- [ ] AbortController cancels in-flight calls within 50ms
- [ ] Hard-coded fallback model list is used when `fetchAvailableModels` errors
- [ ] No PII leaked into error messages

**Depends on:** _(none — Sprint-A is merged)_

### TB.2 -- Prompts as data + settings UI | Cx: 5 | P0

**Description:** Default prompts dictionary (one entry per generator: `summary`, `quiz`, `flashcards`, `teachback`, `formatText`, `chapterSplit`). `getPrompt(key)` returns user override from `prompt_<key>` setting if present, else default. Settings UI: section per prompt with textarea + "Reset to default" button.

**AC:**
- [ ] All 6 default prompts shipped and editable
- [ ] Override persists in IDB and survives reload
- [ ] Reset-to-default deletes the override key
- [ ] No XSS via prompt content (rendered as `textContent`, never `innerHTML`)

**Depends on:** _(none — Sprint-A is merged)_

### TB.3 -- Pattern-based chapter detection | Cx: 8 | P0

**Description:** `detectChapterPatterns(text)` (no AI). Try each regex in priority order; first to match ≥ 2 times wins: (1) `Chapter X` / `CHAPTER ONE` / `chapter I`, (2) `Part X`, (3) `Section X`, (4) numeric/Roman headings on their own line. When AI is configured, run `enhanceChapterTitles(chapters, ...)` to upgrade titles in one batch call. If no patterns found, fall back to plain word-count split (Phase A's default).

**AC:**
- [ ] 3-fixture detection: novel ("Chapter 1"), textbook ("Part I"), paper ("Section 3") — all detected without AI
- [ ] AI title enhancement is a single batched call, not per-chapter
- [ ] Fallback to word-count is silent (no console warning)
- [ ] Unit tests with > 10 input variants

**Depends on:** TB.1

### TB.4 -- Generation cache pattern | Cx: 5 | P0

**Description:** Establish the canonical pattern: `loadXContent(chapter)` → `dbGet('generated', '<type>_${chapter.id}')` → if miss, spinner + generate + cache + render; on error, toast + empty state. The pattern is reused by every AI mode. Document with a clear code comment block + Vitest helper.

**AC:**
- [ ] Pattern documented in `src/lib/cache.ts` (or equivalent) with example
- [ ] Vitest helper `withGenerationCache(type, fn)` exists and is tested
- [ ] Cache-miss observability: console log in dev mode shows hit/miss
- [ ] Pattern adopted by all four B-modes below (verified by code review)

**Depends on:** TB.1

### Phase 2: The four basic modes

### TB.5 -- Summary mode | Cx: 5 | P1

**Description:** `generateSummary(content, title, apiKey)` returns JSON: `keyConcepts: string[]` (3–5), `summary: string` (2–3 paragraphs), `difficulty: 1–5`, `readingTime: minutes`. Render: reading-time + difficulty stars row, key concept pills, formatted summary. Write back `chapter.difficulty` so the library card can show stars.

**AC:**
- [ ] Summary generates, caches as `summary_<chapterId>`, second open is instant
- [ ] `chapter.difficulty` written back and visible on library card
- [ ] Empty state on generation error has a Retry button
- [ ] No XSS in `summary` body

**Depends on:** TB.1, TB.4

### TB.6 -- Classic Quiz mode | Cx: 13 | P0

**Description:** `generateQuiz` returns 5 questions: 3 multiple-choice (options + correctIndex + explanation), 1 true/false, 1 open-ended (with sampleAnswer). Render one at a time; selection reveals answer + explanation. Score summary at end. Save `quiz_scores_<chapterId>` with array of attempts. Best score + attempt count surfaced. "Retake wrong only" filters previously-wrong. "Generate More Questions" appends with do-not-repeat instruction. "Regenerate" deletes cache and restarts.

**AC:**
- [ ] All 3 question types render and grade correctly
- [ ] Score persists per attempt with date
- [ ] Best score + attempt count visible in the chapter quiz hub
- [ ] "Retake wrong only" works on a quiz with mixed correct/incorrect
- [ ] "More questions" appends without duplicates (manual sanity)
- [ ] "Regenerate" clears cache and produces a new quiz

**Depends on:** TB.1, TB.4

### TB.7 -- Flashcards mode | Cx: 5 | P1

**Description:** `generateFlashcards` returns 5–8 cards `{ front, back }`. Card UI with click-to-flip CSS animation. Prev / Next, counter, "More cards" appends.

**AC:**
- [ ] Generates ≥ 5 cards; UI displays one at a time
- [ ] Flip animation runs at 60fps on mid-tier mobile
- [ ] More cards appends without duplicating fronts
- [ ] Cache key `flashcards_<chapterId>`

**Depends on:** TB.1, TB.4

### TB.8 -- Teach-Back mode | Cx: 5 | P1

**Description:** Textarea: "Explain what you learned about <chapter>". Submit → `evaluateTeachback` returns JSON `{ strengths, gaps, suggestions, score }`. Render score badge + the three text fields. Cache by chapterId.

**AC:**
- [ ] Submit yields useful feedback (manual A/B vs. a stub response)
- [ ] Score badge renders with color (red/yellow/green tiers)
- [ ] Cache lets user revisit their last attempt
- [ ] Empty input shows inline validation

**Depends on:** TB.1, TB.4

### Phase 3: Read view polish + safety

### TB.9 -- Markdown renderer + sanitizer | Cx: 8 | P0

**Description:** In-house renderer for `# / ## / ###`, bold/italic, bullet & numbered lists, blockquotes, inline code, code blocks, links (`target=_blank`, `rel=noopener`). Followed by `sanitizeHtml(html)` whitelisting block + inline tags and attributes. Defends against malicious chapter content.

**AC:**
- [ ] All listed Markdown features render correctly
- [ ] XSS fixture (`<script>`, `onerror=`, `javascript:`) is neutralized
- [ ] Vitest test suite covers every renderer rule
- [ ] Links open in new tab with noopener

**Depends on:** _(none — Sprint-A is merged)_

### TB.10 -- Format Text dialog | Cx: 5 | P2

**Description:** Button on book/chapter view. Choices: format current chapter / format all. Calls `generateFormattedHtml` → returns HTML with `<h2>`, `<p>`, `<ul>`, `<strong>`, `<blockquote>`. Stores in `chapter.formattedHtml`; Read view prefers this when present. Progress bar for "format all".

**AC:**
- [ ] Single-chapter formatting works
- [ ] Multi-chapter progress bar updates per-chapter
- [ ] HTML is sanitized before storage
- [ ] Read view falls back to raw text if `formattedHtml` is null

**Depends on:** TB.9, TB.1

### TB.11 -- Settings UX additions | Cx: 5 | P1

**Description:** API key field (`type=password` + show/hide toggle), held **in memory only** via `src/data/secrets.ts` (NOT persisted to IDB or localStorage — locked by the 2026-05-12 Sprint-B audit, finding P2-4). "Test connection" calls `fetchAvailableModels` against the Anthropic provider. Model dropdown auto-loads when a key is set. "Refresh Models" link re-hits the live endpoint.

**AC:**
- [ ] API key is held in memory only via `secrets.ts` (NOT persisted to IDB or localStorage); reload clears it
- [ ] Test connection shows clear success/failure toast
- [ ] Model dropdown lists Anthropic Opus / Sonnet / Haiku tiers (provider swapped from Gemini in the 2026-05-12 audit)
- [ ] Refresh Models hits the live endpoint

**Depends on:** TB.1

### TB.12 -- Error handling (toast + retry) | Cx: 3 | P1

**Description:** Toast on every AI failure with the API message. Replace mode content with an empty-state error block when generation fails inside a mode. Retry button on the empty state.

**AC:**
- [ ] All AI calls surface failures via toast
- [ ] Empty state has a Retry button that re-runs the same call
- [ ] No silent failures (Vitest fakes a 500 and asserts toast)
- [ ] Retry uses the same cache key

**Depends on:** TB.4

---

## Sprint enforcement gates (must pass before Sprint C begins)

- [ ] **G-AC** — all task AC ticked
- [ ] **G-Tests** — ≥ 86% coverage; `parseSafeJson` defensive helper tested
- [ ] **G-Arch** — clean
- [ ] **G-Security** — XSS fixture suite passes; no API keys logged
- [ ] **G-Manual** — Cache pattern locked: `generated` keyed by `<type>_<chapterId>`. Drive sync (F) depends on this — DO NOT rename later.
- [ ] **G-State** — `state.md` updated

**Decision points before Sprint C:**

- [ ] Confirm cache pattern naming
- [ ] Decide whether to expose temperature / maxOutputTokens in Settings now or later
- [ ] Decide whether Format Text Dialog ships in B (recommended) or pushes to C

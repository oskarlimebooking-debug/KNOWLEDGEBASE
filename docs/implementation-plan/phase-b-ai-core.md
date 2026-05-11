# Phase B — AI Core & Basic Learning Modes

> **Tagline:** First AI provider, first generations, first cache.

## Goal

Add Google Gemini as the first AI provider and ship the four most
fundamental learning modes: Summary, Flashcards, Classic Quiz, and
Teach-Back. Build the cache pattern that all later AI features will
reuse.

## Why this phase / rationale

Once a user has a library, the next leap in value is generation:
"summarize this for me", "make me flashcards", "quiz me on it". These
four modes share an identical interaction pattern (cache-first;
generator → JSON → renderer) — building it cleanly once means every
future AI feature plugs in trivially.

Gemini is chosen as the first provider because:
- Generous free tier (good for development).
- Single API key, no OAuth.
- Strong JSON-mode support for structured outputs.
- Multimodal capable (sets up Phase I's AI-OCR).

## Prerequisites

- Phase A complete.

## Deliverables

- Settings: Gemini API key field + model dropdown.
- Settings: customizable prompts per generator (Summary, Quiz,
  Flashcards, Teach-Back).
- Mode tabs in the chapter view: Read | Summary | Quiz | Flashcards |
  Teach-Back.
- Pattern-based chapter detection (no AI required).
- Optional AI-enhanced chapter titles when a key is configured.
- Cache-first generation for all four modes.
- Markdown renderer + HTML sanitizer for the Read view.
- Format-text dialog (AI HTML formatting for the Read view).

## Task breakdown

### B1 — Gemini provider

- `callGeminiAPI(prompt, apiKey, modelOverride, options)`:
  - POST to
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`.
  - 120 s default timeout via AbortController.
  - `options.jsonMode` sets `responseMimeType: 'application/json'`.
  - `options.temperature`, `options.maxOutputTokens` overrides.
  - Throws on non-2xx with the API's error message.
- `fetchAvailableModels(apiKey)` → list models supporting
  `generateContent`. Hard-coded fallback list.
- `getSelectedModel()` reads `selectedModel` setting (default
  `gemini-2.5-flash`).

### B2 — Prompts as data

Default prompts dictionary (one entry per generator). Each generator
calls `getPrompt(key)` which returns the user's override from
`prompt_<key>` setting if present, else the default.

Prompts to seed:
- `summary`
- `quiz`
- `flashcards`
- `teachback`
- `formatText`
- `chapterSplit`

Settings UI: a section per prompt with a textarea and
"Reset to default" button.

### B3 — Pattern-based chapter detection

`detectChapterPatterns(text)` (no AI). Try each regex in priority
order; first to match ≥ 2 times wins:

1. `Chapter X` / `CHAPTER ONE` / `chapter I`
2. `Part X`
3. `Section X`
4. Numeric/Roman headings on their own line

When AI is configured, run `enhanceChapterTitles(chapters, ...)` to
upgrade titles via Gemini in one batch call.

If no patterns found, fall back to plain word-count split (Phase A's
default).

### B4 — Generation cache pattern

For every AI feature:

```js
async function loadXContent(chapter) {
  let cached = await dbGet('generated', `<type>_${chapter.id}`);
  if (!cached) {
    showSpinner();
    try {
      const data = await generateX(chapter.content, chapter.title, apiKey);
      cached = { id: `<type>_${chapter.id}`, chapterId: chapter.id,
                 type: '<type>', data, generatedAt: ISO };
      await dbPut('generated', cached);
    } catch (e) {
      showError(e.message);
      return;
    }
  }
  renderX(cached.data);
}
```

This pattern needs unit tests. Phase M ports it to TypeScript.

### B5 — Summary mode

- `generateSummary(content, title, apiKey)` → JSON with:
  - `keyConcepts: string[]` (3-5)
  - `summary: string` (2-3 paragraphs)
  - `difficulty: 1-5`
  - `readingTime: minutes`
- Render: reading-time + difficulty stars row, key concept pills,
  formatted summary.
- Write back `chapter.difficulty` so the library card can show stars.

### B6 — Classic Quiz mode

- `generateQuiz(content, title, apiKey)` → 5 questions:
  - 3 multiple choice (`type: multiple_choice`, options + correctIndex
    + explanation)
  - 1 true/false
  - 1 open-ended (with sampleAnswer)
- Render one question at a time. Selecting an option immediately reveals
  the answer + explanation.
- After last question: score summary.
- Save score: `quiz_scores_<chapterId>` row with
  `data: [{ percentage, correct, total, date }]`.
- Best score + attempt count surfaced in the hub.
- "Retake wrong only" button: re-renders with only previously-wrong
  questions.
- Generate More Questions: appends 5 new questions with a "do not
  repeat the existing" instruction.
- Regenerate: deletes the cache row and starts fresh.

### B7 — Flashcards mode

- `generateFlashcards(content, title, apiKey)` → 5–8 cards
  `{ front, back }`.
- Card UI with click-to-flip CSS animation.
- Prev / Next, counter, "More cards" appends.

### B8 — Teach-Back mode

- Textarea: "Explain what you learned about <chapter>".
- Submit → `evaluateTeachback(userExplanation, content, title, apiKey)`
  → JSON `{ strengths, gaps, suggestions, score }`.
- Render score badge + the three text fields.
- Cache by chapterId so the user can revisit their last attempt.

### B9 — Markdown renderer (Read view upgrade)

In-house renderer supporting:
- Headers `# / ## / ###`
- Bold / italic
- Bullet lists (`- *`)
- Numbered lists
- Blockquotes
- Inline code, code blocks
- Links (with `target=_blank`, `rel=noopener`)

Followed by `sanitizeHtml(html)` whitelisting block + inline tags and
attributes. Defends against malicious chapter content.

### B10 — Format Text dialog

- Button on the book detail or chapter view.
- Choices: format current chapter / format all chapters.
- Calls `generateFormattedHtml(content, title, apiKey)` → returns HTML
  with `<h2>`, `<p>`, `<ul>`, `<strong>`, `<blockquote>`.
- Stores in `chapter.formattedHtml`. Read view prefers this when
  present.
- Progress bar for "format all".

### B11 — Settings UX additions

- API key field with type=password + show/hide toggle.
- "Test connection" button that calls `fetchAvailableModels`.
- Model dropdown auto-loads when key is set.
- "Refresh Models" link.

### B12 — Error handling

- Toast on every AI failure with the error message.
- Replace mode content with an empty-state error block when generation
  fails inside a mode.
- Retry button on the empty state.

## Acceptance criteria

- [ ] User can paste a Gemini key, save settings, refresh, and see the
      key persisted (in IDB, not localStorage).
- [ ] Summary mode generates and caches; second open is instant.
- [ ] Quiz mode supports all three question types.
- [ ] Flashcards flip and navigate.
- [ ] Teach-Back grading returns useful feedback.
- [ ] Pattern-based chapter detection works on a known well-formatted
      novel without AI.
- [ ] AI-enhanced titles work when AI is configured.
- [ ] Cache hit / miss is observable: deleting a cache row triggers
      regeneration; regenerate button works.
- [ ] Custom prompts saved in settings override the defaults.
- [ ] No XSS via crafted chapter content (test with a fixture
      containing `<script>` and `onerror=`).

## Effort estimate

- **T-shirt:** M
- **Person-weeks:** 3–4
- **Critical path:** prompt design + JSON parsing robustness.

## Risks & unknowns

- **JSON parse failures** — Gemini occasionally returns trailing prose
  even in JSON mode. Implement a defensive `parseSafeJson` helper that
  strips ```json fences and finds matching brace depth. Phase D
  generalizes this for the feed.
- **API quotas** — first-time users may exhaust the free tier on a
  single book. Add a hint and a "small chapters" mode for testing.
- **Prompt drift** — different Gemini versions return slightly
  different shapes. Pin the model version in defaults or version-tag
  the prompts.

## Out of scope

- Mind map / Socratic / Chat (Phase C).
- Feed system (Phase D).
- Listen mode beyond browser TTS placeholder (Phase E).
- Cloud sync (Phase F).
- Speed Round and other quiz variants (Phase G).
- Multiple AI providers (Phase H).
- AI-OCR (Phase I).

## Decision points before Phase C

- [ ] Confirm the cache pattern (`generated` store keyed by
      `<type>_<chapterId>`) is what you want. It's hard to change
      later because Drive sync reads these IDs.
- [ ] Decide whether to expose temperature / maxOutputTokens overrides
      in Settings now or later.
- [ ] Decide whether to ship the Format Text dialog in Phase B (recommended)
      or push it to Phase C.

---

Continue to [Phase C — Mind Map, Socratic, Chat](phase-c-extra-modes.md).

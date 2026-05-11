# 07 — Text Cleaning

The app has **three** distinct text-cleaning pipelines, each tuned for a
different purpose. They are wired into different points of the lifecycle.

| Pipeline | Function | When it fires | Stored where |
|----------|----------|---------------|--------------|
| OCR cleaning | `cleanOCRArtifacts` | After OCR extraction, before chapter detection | Replaces `chapter.content` |
| TTS cleaning | `cleanTextForTTS` | Before sending text to a TTS provider | `tts_cleaned_<chapterId>` cache row |
| Manual cleaning | "Clean Text" modal | Anytime, on demand | Edits `chapter.content` in place |
| Format cleaning | `formatChapterContent` | "Format Text" button | Replaces `chapter.formattedHtml` |

## OCR cleaning (`cleanOCRArtifacts`)

`index.html:12160`. Runs the `ocrClean` prompt template on imported text.
Two modes:

- **Single-pass** (`useSequential = false`): one API call, fastest, may
  truncate on very long books.
- **Sequential**: split into N-word chunks (default 1 000), call the AI
  sequentially, concatenate results.

The default prompt (full text in `index.html:9812`) asks the AI to:

- Remove page artifacts (page numbers, running headers/footers).
- Strip publication metadata (DOIs, ISBNs, "Downloaded from…" lines).
- Drop footnotes, endnotes, references, bibliography.
- Fix OCR errors (split words, hyphenated line breaks, garbled characters).
- Fix spacing.
- **Preserve all body content** — no summarization, no rewriting.
- Return plain text only (no markdown, no HTML).

Sequential processing trades cost for safety: short chunks are far less
likely to be truncated by the model's output limit, and a single bad chunk
doesn't poison the whole book.

### Progress callback

`onProgress(current, total)` lets the caller show a progress bar. The
batch importer surfaces it inline; the resplit modal uses a top banner.

## TTS cleaning (`cleanTextForTTS`)

`index.html:18934`. Runs the `ttsClean` prompt template per chapter,
optionally with table descriptions. Output is cached under
`tts_cleaned_<chapterId>` so future plays don't re-clean.

Settings:

- `tts_clean_<provider>_<chapterId>` — boolean, opt-in per chapter
- `tts_describe_tables_<provider>_<chapterId>` — convert tables to prose
- `tts_sequential_<provider>_<chapterId>` — chunk for long chapters
- `tts_model_<provider>_<chapterId>` — pick a different Gemini model (e.g.
  Gemini Pro for higher quality)

`stripMarkdownForTTS(text)` and `removeCitations(text)` (`index.html:18856`,
18890) are pre-processors that run before the AI cleaning, in case AI
isn't enabled for this chapter:

- Strip `**bold**`, `*italic*`, `# headers`, `[link](url)`, etc.
- Drop bracketed citations `[1]`, `[2,3]`.
- Drop parenthetical citations `(Smith, 2020)`, `(Smith et al., 2020)`.
- Drop superscript Unicode digits.
- Drop `et al.`, `ibid.`, `op. cit.`, `cf.`, `viz.`.

### Default TTS-cleaning prompt highlights

Full text in `index.html:9841`. It asks the AI to remove:

1. Citations (APA, MLA, Chicago, Harvard, footnote markers).
2. Academic artifacts ("See page X", "See Table 1").
3. Formatting artifacts (page numbers, headers, URLs, ISBN).
4. OCR artifacts.
5. (If `describeTables` is on) Convert tables/graphs into spoken
   descriptions.

…while preserving content, headings, lists, dialogue, and important
punctuation.

## Manual text cleaning modal

`openTextCleaning()` (`index.html:24753`).

A dedicated modal where the user can either:

- **Manual search** — type a string, see all chapters where it appears with
  context, multi-select, and **delete**.
- **AI Detect Clutter** — sends a sample of the book to Gemini with a long
  prompt asking it to spot patterns to remove (page numbers, repeated
  headers, OCR artifacts, citations, etc.).

The AI returns a JSON array `[{text, category, reason}]`. The app then
finds every occurrence in every chapter, displays them as match groups,
and lets the user select which to delete.

`detectClutterPatterns(sampleText, apiKey)` (`index.html:24915`) is the
dedicated AI call.

`sequentialProcessingEnabled` (a session-only flag) lets long books be
analyzed in 3-chapter batches with up to 5 000 chars per chapter, then
deduped.

## Format text dialog (`openFormatDialog`)

`index.html:25168`. Different from cleaning — it adds **HTML formatting**
(`<h2>`, `<p>`, `<ul>`, `<strong>`, `<blockquote>`) so the Read mode looks
better. Uses the `formatText` prompt.

Two scopes:

- Single chapter
- All chapters in the book (with a progress bar)

## In-house Markdown / HTML rendering

The Read view renders chapter content via `formatContent(text)` →
`renderMarkdownToHtml(text)` (`index.html:25421`). It supports:

- Headers (`# / ## / ###`)
- Bold, italic
- Bullet lists (`- *`)
- Numbered lists (`1.`)
- Blockquotes (`>`)
- Inline code (`` ` ``)
- Code blocks (` ``` `)
- Links

Followed by `sanitizeHtml(html)` (`index.html:25613`) which whitelists
elements/attributes to defend against malicious chapter content (a
nervous-but-cheap XSS guard given that all content is user-imported).

## Choosing the right tool

| User goal | Use this |
|-----------|----------|
| Imported a scanned book and lots of `[1]` references | OCR cleaning before save |
| Listening, citations are noisy | TTS cleaning per chapter |
| Saw a repeating "Smith Press 2019" footer in 30 chapters | Manual cleaning → AI Detect Clutter |
| Read view looks like a wall of text | Format text |

Continue to [`08-reading-modes.md`](08-reading-modes.md).

# 06 — Chapter Detection

After the raw text is extracted, it has to be split into chapters. The app
uses a **cascading strategy**, each step falling back to the next:

1. `/chapter/` markers (inserted during AI-OCR if user enabled the option)
2. Regex pattern detection (Chapter X / Part X / etc.)
3. AI-based detection (single-pass for short books, sequential for long)
4. AI-refined word-count split
5. Plain word-count split

Plus a **manual** path where the user can insert markers themselves in a
big text editor.

## Entry point

`splitIntoChapters(text, bookTitle, apiKey, modelOverride, useSequential)`
(`index.html:11301`).

Wrapped in a 3-minute hard timeout (`MAX_DETECTION_TIME = 180000`); if any
step locks up, it falls back to plain word count.

## Step 1 — `/chapter/` markers (`splitByChapterMarkers`)

`index.html:11346`. If the text contains `/chapter/` strings, they take
precedence. Format:

```
/chapter/  Optional inline title
```

Regex: `/^[ \t]*\/chapter\/[ \t]*(.*?)$/gmi`. The optional capture is used
as the chapter title; otherwise the first non-empty line of the chapter
content is used.

The text *before* the first `/chapter/` becomes "Introduction" / first
chapter (or is dropped if < 50 chars).

This is the most reliable mode and is recommended whenever the user has
control over the OCR output.

## Step 2 — Regex pattern detection (`detectChapterPatterns`)

`index.html:11412`. Matches one of four heading patterns in priority
order:

1. `Chapter 1` / `CHAPTER ONE` / `chapter I` (with optional subtitle)
2. `Part 1` / `PART I`
3. `Section 1`
4. Numeric/Roman heading: `1.`, `I.`, `IV.`

It picks the first pattern that yields ≥ 2 matches, then sorts and slices.
Chapters with fewer than 100 chars are dropped.

If the user has Gemini configured, the resulting titles are run through
`enhanceChapterTitles` (`index.html:11495`) to get more descriptive titles
based on a 200-char preview of each chapter.

## Step 3 — AI sequential detection (`aiBasedChapterDetection`)

`index.html:11529`. For long books (`text.length > 25000 * 1.5`).

```
chunkSize = 25 000 chars
overlapSize = 3 000 chars

while not done:
  chunk = text[start : start + chunkSize]
  boundaries = findChapterBoundariesInChunk(chunk, ...)
  allBoundaries.push(...boundaries)
  start = chunkEnd - overlapSize
  sleep(500)   // rate limiting

mergeBoundaries(...)              // dedupe within ±500 chars
buildChaptersFromBoundaries(...)
```

`findChapterBoundariesInChunk` (`index.html:11623`) sends an explicit prompt
asking for an array of `{position, title, firstWords}`. The merger then
verifies each boundary by searching for `firstWords` in a ±200 char window
around the AI's reported position, accepting fuzzy matches (first 8 words →
first 5 words).

If a boundary's `firstWords` cannot be found anywhere, that boundary is
dropped — protecting against AI hallucinations.

### Single-pass variant (`singlePassChapterDetection`)

For short books, runs the user's customizable `chapterSplit` prompt against
the entire text in one call. The default prompt asks for a JSON array of
`{title, startMarker}` pairs. `extractChaptersFromOriginalText` then walks
the original text and fuzzy-matches each `startMarker` (4 strategies:
exact / first-8-words / first-5-words / whitespace-normalized).

If fewer than 30% of the AI's markers can be matched, the call is treated
as a failure and the next fallback fires.

## Step 4 — AI-refined word-count split (`splitByWordCountWithAI`)

`index.html:11996`. Used when the user explicitly chose word-count mode.

1. Compute rough cut points every `targetWordsPerChapter` words.
2. For each rough cut, extract `± 20 lines` of context.
3. Send all the context blocks to Gemini in a **single batch request**
   asking "for each, find the best natural break point and provide the
   exact line where the new chapter should begin, plus a chapter title".
4. Parse the JSON, find each suggested break line in the source, build
   chapters between adjacent break positions.

This is faster and cheaper than full sequential detection because it makes
one API call regardless of book length, and it always succeeds in
producing N chapters (since the rough cut points are deterministic).

## Step 5 — Plain word-count fallback (`splitByWordCount`)

`index.html:11979`. The brute fallback. Just slices into N-word buckets.

Default `wordsPerChapter = 2000`.

## Manual mode (`openManualChapterEditor`)

`index.html:9080`. Opens a big text-area where the user can:

- Click anywhere and hit **Insert Marker** to add `<<<CHAPTER>>>` at
  cursor.
- Run **Auto-detect markers** to have the AI insert them based on the
  current text.
- Hit **Preview** to see the resulting chapter list.
- Hit **Confirm** to commit.

Manual markers use the format `<<<CHAPTER|Optional Title>>>`.
`splitByManualMarkers` (`index.html:9209`) parses them.

## Re-split flow (`openResplitChapters`)

`index.html:8956`. After import, the user can re-split a book at any time:

- Choose mode (auto / wordcount / manual).
- For wordcount, set the target.
- Confirms by deleting all existing chapters + their `generated/*` cache
  entries (since chapter IDs change), then re-running the same pipeline.

## Chapter review modal (`openChapterReviewModal`)

`index.html:8555`. Pre-import editor for the staged `pendingChapters`
array.

Operations:
- Edit content (large textarea modal)
- Edit title
- Split at cursor (`splitChapterAt`)
- Merge with previous (`mergeWithPrevious`)
- Delete (`deleteChapter`)
- Add new (`addNewChapter`)
- Auto-renumber (`autoRenumberChapters`)
- Re-split with word count (`resplitWithWordCount`)
- Re-analyze (`reanalyzeChapters` — re-runs `splitIntoChapters`)

## Title prediction

`predictDocumentTitle(text, fileName)` calls Gemini with the first ~3 000
chars of the text and asks for a single best title. Falls back to the file
name (sans extension, with underscores → spaces, smart-cased) on AI
failure.

## Coverage validation

After every detection method, the app computes
`capturedLength / originalText.length`. If < 80%, it logs a warning and may
append a "Continuation" chapter for the trailing text.

Continue to [`07-text-cleaning.md`](07-text-cleaning.md).

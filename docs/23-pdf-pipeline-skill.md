# 23 — PDF Pipeline Skill (CLAUDE.md)

`CLAUDE.md` at the repo root contains a "PDF Article Pipeline" skill that
Claude Code can invoke to bulk-import a folder of PDFs through Claude
itself, bypassing the in-app importer.

The skill has two phases:

1. A small Python helper extracts raw text from each PDF (with OCR
   fallback via Tesseract) and base64-encodes the binaries.
2. Claude itself cleans the text, generates 20 personality-driven feed
   posts per chapter, and writes a single `chapterwise-import.json` to
   the repo root that the app picks up automatically.

## Why this exists

The in-app pipeline is excellent for one or two books. For ten papers at
once — typical of a research library import — it's faster to:

- Run a tiny script to OCR + base64 everything.
- Hand the raw text to Claude (which already has access to the file
  system).
- Have Claude write a clean import package.
- Drop the package into the repo and let the app's auto-detect banner
  handle the rest.

This avoids spinning the browser for hours and uses Claude's faster bulk
text processing.

## User-facing checklist

Before running the skill, the user is asked four questions (defaults in
bold):

1. **Book grouping** — combine all PDFs into one book, or **separate
   books** (one PDF = one book)?
2. **Tables/graphs** — **describe in natural language** (TTS-friendly) or
   exclude entirely?
3. **References / bibliography** — **remove** the trailing References
   section?
4. **Chapter markers within PDFs** — should each PDF be split by section
   (Introduction / Methods / Results / Discussion) using `/chapter/`
   markers? **Default: no**.

## Phase 1 — Text extraction (Python)

```python
#!/usr/bin/env python3
"""
PDF Text Extractor for ChapterWise/Headway
"""
import os, json, base64, glob, fitz   # pymupdf
from PIL import Image
import pytesseract

def extract_raw_text(pdf_path):
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        page_text = page.get_text()
        if len(page_text.strip()) < 50:
            # OCR fallback for scanned pages
            pix = page.get_pixmap(dpi=300)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            page_text = pytesseract.image_to_string(img)
        text += page_text + "\n"
    return text

def main(folder):
    pdfs = sorted(glob.glob(os.path.join(folder, "*.pdf")))
    for pdf_path in pdfs:
        name = os.path.splitext(os.path.basename(pdf_path))[0]
        raw_text = extract_raw_text(pdf_path)
        with open(pdf_path, "rb") as f:
            pdf_b64 = base64.b64encode(f.read()).decode()
        with open(os.path.join(folder, f"{name}.raw.txt"), "w") as f:
            f.write(raw_text)
        # save metadata too
```

The Python script writes:
- `<name>.raw.txt` — extracted raw text per PDF
- `extraction_results.json` — sizes manifest

## Phase 2 — Claude does the work

Claude reads each `.raw.txt`, cleans it according to the user's
preferences, generates the feed JSON, and writes the import package. No
external AI API call is needed because **Claude is the AI**.

### Cleaning rules (TTS-ready)

The skill insists on text that reads well aloud:

- Remove page headers/footers (repeated lines).
- Fix `word-\nbreak` → `wordbreak` hyphenation.
- Strip OCR artifacts.
- Use single line breaks within paragraphs, double between paragraphs.
- No double spaces, leading spaces, trailing spaces, or orphaned
  mid-sentence breaks.
- No raw markdown (`**bold**`, `# headers`).
- Section headings on their own line.
- Remove `[1]`, `(Smith et al., 2020)`-style citations.
- Tables: describe in prose (e.g. "The table shows that A had a 45%
  success rate compared to 30% for the control") OR replace with
  `[Table omitted]` based on user preference.
- References section: removed if user requested.

### Feed generation

For each chapter, Claude generates 20 posts matching the schema in
[`10-feed-system.md`](10-feed-system.md):

- 7 personalities, balanced counts.
- Mix of short hits and threads (`🧵 Thread:` openers).
- 3 with images + detailed `imagePrompt` (style hint per personality).
- 5–6 with `linkTopic` (deep-dive writeups).
- 3–4 marked `isViral: true`.

### Package writeup

Claude writes `chapterwise-import.json` to the repo root using the schema
in [`22-import-file-format.md`](22-import-file-format.md):

```jsonc
{
  "version": 1,
  "syncedAt": "<ISO>",
  "books": [
    { "id": "book_<ts>", "title": "...", "author": "...", "genre": "Research",
      "description": "...", "totalChapters": 1, "addedAt": "<ISO>",
      "pdfData": "<base64>", "_pdfDataIsBase64": true }
  ],
  "chapters": [
    { "id": "book_<ts>_ch_0", "bookId": "book_<ts>", "title": "...",
      "number": 1, "content": "<cleaned>", "text": "<cleaned>" }
  ],
  "progress": [],
  "generated": [
    { "id": "feed_book_<ts>_ch_0", "chapterId": "book_<ts>_ch_0",
      "type": "feed", "data": { "posts": [ ... ] },
      "generatedAt": "<ISO>" }
  ],
  "settings": {}
}
```

## What the user does next

1. Refresh the app.
2. The green import banner appears: "Import Package Found - X book(s),
   Y chapter(s), Z feed(s)".
3. Click Import.
4. The app:
   - Stores books + chapters + feeds in IDB.
   - Auto-renders cover thumbnails from the embedded PDF data.
5. Delete `chapterwise-import.json` to make the banner disappear (it's
   already in `.gitignore`).

## Alternative: Drive upload

If the user has a Drive access token in the environment, the skill can
upload directly to `chapterwise-sync.json` instead of writing the local
import file:

```bash
# Find existing
curl -s "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='chapterwise-sync.json'" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Update it
curl -X PATCH "https://www.googleapis.com/upload/drive/v3/files/$FILE_ID?uploadType=media" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @chapterwise-import.json
```

## Limits and gotchas

- Base64 doubles the size. For collections > 50 MB total, set
  `_pdfDataExcluded: true` and skip `pdfData` to keep the import file
  small (covers won't auto-generate but the metadata still imports).
- The PDF binary is stored per-book — large books mean large
  `chapterwise-import.json`.
- Re-importing is idempotent (upsert by ID).
- Cleaning quality depends on the input. Heavily formatted academic PDFs
  with multi-column layouts may still need manual cleanup post-import.

Continue to [`24-future-development.md`](24-future-development.md).

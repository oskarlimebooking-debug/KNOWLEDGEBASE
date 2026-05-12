---
id: TA.4
title: Add Book flow (PDF + EPUB)
plan: plan-sprint-0-engage
type: feature
priority: P0
complexity: 13
status: pending
sprint: '0'
depends_on:
- TA.2
- TA.3
---

# Add Book flow (PDF + EPUB)

Big "+ Add Book" button, file input accepting `.pdf,.epub`. PDFs: PDF.js text extraction (worker from cdnjs), reconstruct lines from transform matrix, detect paragraph breaks via line-height, detect bullets. EPUBs: JSZip + parse `META-INF/container.xml` → OPF → HTML → strip tags. Auto-extract title from page 1 (PDF) or `<dc:title>` (EPUB). Plain word-count chapter splitter (default 2000 w/ch). Cover thumb (300×400 canvas) JPEG data URL; EPUB fallback to emoji-from-keyword. Save book + chapters to IDB.

# Acceptance Criteria

- [ ] EPUB import: 3-fixture EPUBs (novel / textbook / mixed) all open with title + chapters
- [ ] PDF import: 3-fixture PDFs (text-only / scanned-text / column-heavy) extract text and chapter-split
- [ ] PDFs > 5 MB skip cover generation gracefully (no OOM)
- [ ] Save commits all rows in a single IDB transaction; partial failure rolls back
- [ ] Manual test passes on iOS Safari with one EPUB

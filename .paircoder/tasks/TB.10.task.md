---
id: TB.10
title: Format Text dialog
plan: plan-sprint-0-engage
type: feature
priority: P2
complexity: 5
status: done
sprint: '0'
depends_on:
- TB.9
- TB.1
completed_at: '2026-05-13T11:31:27.807154'
---

# Format Text dialog

Button on book/chapter view. Choices: format current chapter / format all. Calls `generateFormattedHtml` → returns HTML with `<h2>`, `<p>`, `<ul>`, `<strong>`, `<blockquote>`. Stores in `chapter.formattedHtml`; Read view prefers this when present. Progress bar for "format all".

# Acceptance Criteria

- [x] Single-chapter formatting works (`formatChapter(chapter, apiKey)` → `callAnthropic` → `sanitizeHtml` → `dbPut(STORE_CHAPTERS, ...)`; dialog test exercises end-to-end with `onAfterFormat` callback)
- [x] Multi-chapter progress bar updates per-chapter (`formatAllChapters` invokes `onProgress` after each chapter completion; dialog re-renders the progress tree with current/total + percent fill on each tick; test confirms status container is populated mid-run)
- [x] HTML is sanitized before storage (every `formatChapter` call routes through TB.9's `sanitizeHtml`; test confirms `<script>` / `onerror=` are stripped from the persisted `formattedHtml`)
- [x] Read view falls back to raw text if `formattedHtml` is null (`renderChapter` checks `chapter.formattedHtml` length > 0; falls back to `splitParagraphs(content)` otherwise)
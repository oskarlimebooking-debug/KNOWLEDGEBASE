---
id: TB.5
title: Summary mode
plan: plan-sprint-0-engage
type: feature
priority: P1
complexity: 5
status: in_progress
sprint: '0'
depends_on:
- TB.1
- TB.4
---

# Summary mode

`generateSummary(content, title, apiKey)` returns JSON: `keyConcepts: string[]` (3–5), `summary: string` (2–3 paragraphs), `difficulty: 1–5`, `readingTime: minutes`. Render: reading-time + difficulty stars row, key concept pills, formatted summary. Write back `chapter.difficulty` so the library card can show stars.

# Acceptance Criteria

- [x] Summary generates, caches as `summary_<chapterId>`, second open is instant
- [x] `chapter.difficulty` written back and visible on library card
- [x] Empty state on generation error has a Retry button
- [x] No XSS in `summary` body
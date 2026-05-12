---
id: TB.3
title: Pattern-based chapter detection
plan: plan-sprint-0-engage
type: feature
priority: P0
complexity: 8
status: pending
sprint: '0'
depends_on:
- TB.1
---

# Pattern-based chapter detection

`detectChapterPatterns(text)` (no AI). Try each regex in priority order; first to match ≥ 2 times wins: (1) `Chapter X` / `CHAPTER ONE` / `chapter I`, (2) `Part X`, (3) `Section X`, (4) numeric/Roman headings on their own line. When AI is configured, run `enhanceChapterTitles(chapters, ...)` to upgrade titles in one batch call. If no patterns found, fall back to plain word-count split (Phase A's default).

# Acceptance Criteria

- [ ] 3-fixture detection: novel ("Chapter 1"), textbook ("Part I"), paper ("Section 3") — all detected without AI
- [ ] AI title enhancement is a single batched call, not per-chapter
- [ ] Fallback to word-count is silent (no console warning)
- [ ] Unit tests with > 10 input variants

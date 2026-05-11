---
id: TA.2
title: IndexedDB schema + wrappers
plan: plan-sprint-0-engage
type: feature
priority: P0
complexity: 8
status: in_progress
sprint: '0'
depends_on:
- TA.1
---

# IndexedDB schema + wrappers

Open DB `ChapterWiseDB` v1 with five stores: `books`, `chapters`, `progress`, `generated`, `settings`. Indices on `books.addedAt`, `chapters.bookId`, `progress.bookId`+`progress.date`, `generated.chapterId`. Wrappers: `dbPut`, `dbGet`, `dbGetAll`, `dbGetByIndex`, `dbDelete`. Settings helpers `getSetting(key)` / `setSetting(key, value)`. Schema docs in code comments.

# Acceptance Criteria

- [ ] DB opens on first run and on refresh
- [ ] All five stores exist with the documented indices
- [ ] Wrappers covered by Vitest unit tests (≥ 90% branch coverage)
- [ ] Settings round-trip cleanly through `getSetting` / `setSetting`
- [ ] No console errors on hot reload
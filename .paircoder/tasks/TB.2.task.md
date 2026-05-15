---
id: TB.2
title: Prompts as data + settings UI
plan: plan-sprint-0-engage
type: feature
priority: P0
complexity: 5
status: done
sprint: '0'
depends_on: []
---

# Prompts as data + settings UI

Default prompts dictionary (one entry per generator: `summary`, `quiz`, `flashcards`, `teachback`, `formatText`, `chapterSplit`). `getPrompt(key)` returns user override from `prompt_<key>` setting if present, else default. Settings UI: section per prompt with textarea + "Reset to default" button.

# Acceptance Criteria

- [x] All 6 default prompts shipped and editable
- [x] Override persists in IDB and survives reload
- [x] Reset-to-default deletes the override key
- [x] No XSS via prompt content (rendered as `textContent`, never `innerHTML`)
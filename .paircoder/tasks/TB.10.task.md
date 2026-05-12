---
id: TB.10
title: Format Text dialog
plan: plan-sprint-0-engage
type: feature
priority: P2
complexity: 5
status: pending
sprint: '0'
depends_on:
- TB.9
- TB.1
---

# Format Text dialog

Button on book/chapter view. Choices: format current chapter / format all. Calls `generateFormattedHtml` → returns HTML with `<h2>`, `<p>`, `<ul>`, `<strong>`, `<blockquote>`. Stores in `chapter.formattedHtml`; Read view prefers this when present. Progress bar for "format all".

# Acceptance Criteria

- [ ] Single-chapter formatting works
- [ ] Multi-chapter progress bar updates per-chapter
- [ ] HTML is sanitized before storage
- [ ] Read view falls back to raw text if `formattedHtml` is null

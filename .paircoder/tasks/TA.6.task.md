---
id: TA.6
title: Book detail view
plan: plan-sprint-0-engage
type: feature
priority: P1
complexity: 5
status: pending
sprint: '0'
depends_on:
- TA.5
---

# Book detail view

Title, author, cover. "X / Y chapters complete" progress bar. Chapter list with title + completion check + click handler. Delete book button with confirmation dialog.

# Acceptance Criteria

- [ ] Progress bar reflects IDB state on first render
- [ ] Delete book cascades: book + chapters + progress + generated rows all removed
- [ ] Confirmation dialog blocks accidental deletion (Escape cancels)
- [ ] Cover renders or falls back to placeholder

---
id: TA.5
title: Library grid view
plan: plan-sprint-0-engage
type: feature
priority: P1
complexity: 5
status: pending
sprint: '0'
depends_on:
- TA.3
- TA.4
---

# Library grid view

Grid of book cards (cover, title, author, progress %). Click → `setView('book')` and render chapter list. Empty state with "Add your first book". Daily card at top showing today's suggested chapter (next incomplete chapter in most recently opened book). Streak counter chip from `progress.date` distinct values.

# Acceptance Criteria

- [x] Library renders ≤ 100ms for a 50-book library on a baseline laptop
- [x] Empty state shows when library is empty
- [x] Daily card surfaces the correct chapter (verify with two-book fixture)
- [x] Streak counter increments correctly across midnight boundary (manual test or mocked clock)

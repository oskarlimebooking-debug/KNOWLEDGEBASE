---
id: TA.10
title: Offline behavior verification
plan: plan-sprint-0-engage
type: feature
priority: P0
complexity: 5
status: pending
sprint: '0'
depends_on:
- TA.9
---

# Offline behavior verification

Library, book detail, chapter view, mark-complete, streak counter, export-data all work offline once a book is in IDB. Optional offline banner on `navigator.onLine === false`.

# Acceptance Criteria

- [ ] Playwright e2e: load app, add a book, disable network, navigate library → book → chapter → mark complete → all succeed
- [ ] Streak counter increments correctly while offline
- [ ] Export Data works offline
- [ ] Offline banner (if implemented) appears within 1s of going offline

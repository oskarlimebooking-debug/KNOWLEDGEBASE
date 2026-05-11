---
id: TA.3
title: App shell + view system
plan: plan-sprint-0-engage
type: feature
priority: P0
complexity: 5
status: pending
sprint: '0'
depends_on:
- TA.1
---

# App shell + view system

Single `<div class="app">` with view classes `view-library`, `view-book`, `view-chapter`, `view-modal-stack`. `setView(name)` toggles modifier classes; CSS shows the right child. Header with back button, app title, settings gear. `showToast(msg, kind)` component. Loading spinner component. Mobile-first responsive grid.

# Acceptance Criteria

- [ ] `setView('library' | 'book' | 'chapter')` swaps content with no flicker
- [ ] Header responds to back-button taps on every non-root view
- [ ] Toast renders 4 kinds (info / success / warn / error) and auto-dismisses
- [ ] Layout reflows correctly at 320px, 768px, 1280px widths
- [ ] No CLS issues per Lighthouse

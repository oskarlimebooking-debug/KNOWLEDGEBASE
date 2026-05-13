---
id: TB.12
title: Error handling (toast + retry)
plan: plan-sprint-0-engage
type: feature
priority: P1
complexity: 3
status: done
sprint: '0'
depends_on:
- TB.4
completed_at: '2026-05-13T09:06:02.119891'
---

# Error handling (toast + retry)

Toast on every AI failure with the API message. Replace mode content with an empty-state error block when generation fails inside a mode. Retry button on the empty state.

# Acceptance Criteria

- [x] All AI calls surface failures via toast
- [x] Empty state has a Retry button that re-runs the same call
- [x] No silent failures (Vitest fakes a 500 and asserts toast)
- [x] Retry uses the same cache key
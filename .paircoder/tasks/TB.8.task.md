---
id: TB.8
title: Teach-Back mode
plan: plan-sprint-0-engage
type: feature
priority: P1
complexity: 5
status: failed
sprint: '0'
depends_on:
- TB.1
- TB.4
completed_at: '2026-05-12T23:31:23.717064'
---

# Teach-Back mode

Textarea: "Explain what you learned about <chapter>". Submit → `evaluateTeachback` returns JSON `{ strengths, gaps, suggestions, score }`. Render score badge + the three text fields. Cache by chapterId.

# Acceptance Criteria

- [x] Submit yields useful feedback (manual A/B vs. a stub response)
- [x] Score badge renders with color (red/yellow/green tiers)
- [x] Cache lets user revisit their last attempt
- [x] Empty input shows inline validation
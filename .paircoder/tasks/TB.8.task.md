---
id: TB.8
title: Teach-Back mode
plan: plan-sprint-0-engage
type: feature
priority: P1
complexity: 5
status: pending
sprint: '0'
depends_on:
- TB.1
- TB.4
---

# Teach-Back mode

Textarea: "Explain what you learned about <chapter>". Submit → `evaluateTeachback` returns JSON `{ strengths, gaps, suggestions, score }`. Render score badge + the three text fields. Cache by chapterId.

# Acceptance Criteria

- [ ] Submit yields useful feedback (manual A/B vs. a stub response)
- [ ] Score badge renders with color (red/yellow/green tiers)
- [ ] Cache lets user revisit their last attempt
- [ ] Empty input shows inline validation

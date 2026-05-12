---
id: TB.11
title: Settings UX additions
plan: plan-sprint-0-engage
type: feature
priority: P1
complexity: 5
status: pending
sprint: '0'
depends_on:
- TB.1
---

# Settings UX additions

API key field (`type=password` + show/hide toggle). "Test connection" calls `fetchAvailableModels`. Model dropdown auto-loads when key is set. "Refresh Models" link.

# Acceptance Criteria

- [ ] Key persists in IDB (NOT localStorage)
- [ ] Test connection shows clear success/failure toast
- [ ] Model dropdown lists Gemini Flash + Pro tiers
- [ ] Refresh Models hits the live endpoint

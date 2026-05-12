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

- [ ] Key kept in memory only via `src/data/secrets.ts` (per Sprint A audit P1-#2 lock — **NOT** IDB and **NOT** localStorage). User re-enters the key each browser session.
- [ ] Test connection shows clear success/failure toast
- [ ] Model dropdown lists Claude Opus / Sonnet / Haiku tiers (sourced from `client.models.list()` via `fetchAvailableModels`, with `FALLBACK_MODELS` as the offline fallback)
- [ ] Refresh Models hits the live `models.list` endpoint

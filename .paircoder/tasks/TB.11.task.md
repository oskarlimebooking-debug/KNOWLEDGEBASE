---
id: TB.11
title: Settings UX additions
plan: plan-sprint-0-engage
type: feature
priority: P1
complexity: 5
status: in_progress
sprint: '0'
depends_on:
- TB.1
---

# Settings UX additions

API key field (`type=password` + show/hide toggle), held **in memory only** via `src/data/secrets.ts` (NOT persisted to IDB or localStorage — locked by the 2026-05-12 Sprint-B audit, finding P2-4). "Test connection" calls `fetchAvailableModels` against the Anthropic provider. Model dropdown auto-loads when a key is set. "Refresh Models" link re-hits the live endpoint.

# Acceptance Criteria

- [x] API key is held in memory only via `secrets.ts` (NOT persisted to IDB or localStorage); reload clears it
- [x] Test connection shows clear success/failure toast
- [x] Model dropdown lists Anthropic Opus / Sonnet / Haiku tiers (provider swapped from Gemini in the 2026-05-12 audit)
- [x] Refresh Models hits the live endpoint
---
id: TB.4
title: Generation cache pattern
plan: plan-sprint-0-engage
type: feature
priority: P0
complexity: 5
status: pending
sprint: '0'
depends_on:
- TB.1
---

# Generation cache pattern

Establish the canonical pattern: `loadXContent(chapter)` → `dbGet('generated', '<type>_${chapter.id}')` → if miss, spinner + generate + cache + render; on error, toast + empty state. The pattern is reused by every AI mode. Document with a clear code comment block + Vitest helper.

# Acceptance Criteria

- [ ] Pattern documented in `src/lib/cache.ts` (or equivalent) with example
- [ ] Vitest helper `withGenerationCache(type, fn)` exists and is tested
- [ ] Cache-miss observability: console log in dev mode shows hit/miss
- [ ] Pattern adopted by all four B-modes below (verified by code review)

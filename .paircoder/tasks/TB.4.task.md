---
id: TB.4
title: Generation cache pattern
plan: plan-sprint-0-engage
type: feature
priority: P0
complexity: 5
status: done
sprint: '0'
depends_on:
- TB.1
completed_at: '2026-05-12T22:58:03.762168'
---

# Generation cache pattern

Establish the canonical pattern: `loadXContent(chapter)` → `dbGet('generated', '<type>_${chapter.id}')` → if miss, spinner + generate + cache + render; on error, toast + empty state. The pattern is reused by every AI mode. Document with a clear code comment block + Vitest helper.

# Acceptance Criteria

- [x] Pattern documented in `src/lib/cache.ts` with usage example in the module header (full TB.5-style call site, error handling, retry hook)
- [x] Vitest helper `withGenerationCache(type, fn)` exists and is tested (14 tests in `cache.test.ts`)
- [x] Cache-miss observability: `console.debug('[gen cache] hit|miss <key>')` fires when `import.meta.env.DEV === true`; silent in prod
- [ ] Pattern adopted by all four B-modes below (verified by code review) — DEFERRED to TB.5/TB.6/TB.7/TB.8 — adoption is verified per-mode when each ships
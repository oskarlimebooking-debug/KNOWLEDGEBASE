---
id: TA.7
title: Chapter view (Read mode only)
plan: plan-sprint-0-engage
type: feature
priority: P1
complexity: 5
status: pending
sprint: '0'
depends_on:
- TA.6
---

# Chapter view (Read mode only)

Header with chapter title. Body: `chapter.content` as paragraphs (no markdown yet). Mark Complete button at bottom. Previous/Next chapter navigation.

# Acceptance Criteria

- [x] Paragraph rendering preserves blank lines
- [x] Mark Complete writes a `progress` row and updates the button to "Completed"
- [x] Prev / Next disabled at boundaries
- [x] No layout shift after mark-complete

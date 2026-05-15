---
id: TB.7
title: Flashcards mode
plan: plan-sprint-0-engage
type: feature
priority: P1
complexity: 5
status: done
sprint: '0'
depends_on:
- TB.1
- TB.4
completed_at: '2026-05-12T23:21:58.756348'
---

# Flashcards mode

`generateFlashcards` returns 5–8 cards `{ front, back }`. Card UI with click-to-flip CSS animation. Prev / Next, counter, "More cards" appends.

# Acceptance Criteria

- [x] Generates ≥ 5 cards; UI displays one at a time
- [x] Flip animation runs at 60fps on mid-tier mobile
- [x] More cards appends without duplicating fronts
- [x] Cache key `flashcards_<chapterId>`
---
id: TB.7
title: Flashcards mode
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

# Flashcards mode

`generateFlashcards` returns 5–8 cards `{ front, back }`. Card UI with click-to-flip CSS animation. Prev / Next, counter, "More cards" appends.

# Acceptance Criteria

- [ ] Generates ≥ 5 cards; UI displays one at a time
- [ ] Flip animation runs at 60fps on mid-tier mobile
- [ ] More cards appends without duplicating fronts
- [ ] Cache key `flashcards_<chapterId>`

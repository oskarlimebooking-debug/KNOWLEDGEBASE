---
id: TB.6
title: Classic Quiz mode
plan: plan-sprint-0-engage
type: feature
priority: P0
complexity: 13
status: failed
sprint: '0'
depends_on:
- TB.1
- TB.4
---

# Classic Quiz mode

`generateQuiz` returns 5 questions: 3 multiple-choice (options + correctIndex + explanation), 1 true/false, 1 open-ended (with sampleAnswer). Render one at a time; selection reveals answer + explanation. Score summary at end. Save `quiz_scores_<chapterId>` with array of attempts. Best score + attempt count surfaced. "Retake wrong only" filters previously-wrong. "Generate More Questions" appends with do-not-repeat instruction. "Regenerate" deletes cache and restarts.

# Acceptance Criteria

- [ ] All 3 question types render and grade correctly
- [ ] Score persists per attempt with date
- [ ] Best score + attempt count visible in the chapter quiz hub
- [ ] "Retake wrong only" works on a quiz with mixed correct/incorrect
- [ ] "More questions" appends without duplicates (manual sanity)
- [ ] "Regenerate" clears cache and produces a new quiz
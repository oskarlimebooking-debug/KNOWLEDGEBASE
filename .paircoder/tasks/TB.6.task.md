---
id: TB.6
title: Classic Quiz mode
plan: plan-sprint-0-engage
type: feature
priority: P0
complexity: 13
status: in_progress
sprint: '0'
depends_on:
- TB.1
- TB.4
---

# Classic Quiz mode

`generateQuiz` returns 5 questions: 3 multiple-choice (options + correctIndex + explanation), 1 true/false, 1 open-ended (with sampleAnswer). Render one at a time; selection reveals answer + explanation. Score summary at end. Save `quiz_scores_<chapterId>` with array of attempts. Best score + attempt count surfaced. "Retake wrong only" filters previously-wrong. "Generate More Questions" appends with do-not-repeat instruction. "Regenerate" deletes cache and restarts.

# Acceptance Criteria

- [x] All 3 question types render and grade correctly (`gradeQuiz` tests + `renderMCBody`/`renderTFBody`/`renderOEBody`; MC + T/F count toward score, open-ended excluded as designed)
- [x] Score persists per attempt with date (`recordQuizAttempt` writes `{date, percent, correctCount, gradedCount, wrongIndices}` to `quiz_scores_<chapterId>` in the settings store)
- [x] Best score + attempt count visible in the chapter quiz hub (`quizStats(attempts)` → hub renders `Best 75% · 2 attempts`)
- [x] "Retake wrong only" works on a quiz with mixed correct/incorrect (`filterQuiz` with `lastWrongIndices`; `indexMap` writes wrong positions back to the original quiz indices for the next attempt)
- [x] "More questions" appends without duplicates (`appendMoreQuestions` sends every existing prompt in the `Do NOT repeat:` instruction; merge writes back to cache). The literal "no duplicates" guarantee depends on the model honouring the instruction; we do not programmatically de-dup post-response.
- [x] "Regenerate" clears cache and produces a new quiz (`regenerateQuiz` calls `invalidateGeneration('quiz', ...)` then `loadQuiz`; test asserts the second fetch happens)
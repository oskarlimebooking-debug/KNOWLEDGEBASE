# Phase G — Advanced Quizzes and Learning Hub

> **Tagline:** Five more quiz modes plus six cross-chapter games.

## Goal

Round out the quiz experience with five additional mode variants, plus
add a book-level **Learning Hub** with six cross-chapter games that
test understanding across an entire book.

## Why this phase / rationale

Phase B's classic quiz is a starting point but feels samey after a
few uses. Variation drives engagement. Each new mode tests a different
cognitive skill:

- **Speed Round** — fluency under pressure.
- **Fill in the Blanks** — recall without options.
- **Devil's Advocate** — argumentative defense.
- **Connections** — pattern matching.
- **Who Am I?** — partial-information reasoning.

The Learning Hub elevates the test surface from a single chapter to
the whole book, which surfaces blind spots that a chapter-by-chapter
test would miss.

## Prerequisites

- Phase B (quiz baseline + score persistence).
- Phase C (conversation component for Devil's Advocate).
- Phase F (sync, so quiz scores and Learning Hub state survive across
  devices).

## Deliverables

- ⚡ Speed Round: 10 rapid-fire MC, 15s each, time-bonus scoring.
- 📝 Fill in the Blanks: 8 sentences with key terms removed.
- 🎭 Devil's Advocate: 5 counter-argument debates.
- 🔗 Connections: match concepts to definitions/examples.
- 🎯 Who Am I?: progressive-clue concept guessing.
- 🏆 Learning Hub modal opened from book detail.
- Cross-chapter quiz (10 Qs sampling from all chapters).
- Weak-spot quiz (focuses on chapters with low quiz scores).
- Book debate (Devil's Advocate over the whole book).
- Timeline challenge (drag-and-drop events into chronological order).
- Explain simply (rephrase a concept at 5 / 10 / 15-year-old level).
- Scenario sim (apply book principles to hypothetical scenarios).
- Per-mode score persistence and best-score leaderboards.

## Task breakdown

### G1 — Speed Round

`startSpeedRound(chapter)`:
- Sample 10 MC questions from the cached quiz pool. If fewer than 10,
  generate more.
- Per-question 15s timer.
- Visual progress bar.
- Selection auto-advances after a 1.5s reveal.
- Final score = correct/total + time bonus (faster correct answers
  earn more points).
- Save best score with `saveQuizScore` (Phase B helper).

### G2 — Fill in the Blanks

Custom AI prompt (separate from the standard quiz prompt):
```
Extract 8 sentences from the chapter and replace key terms with ____.
Each blank should have an answer + a hint.
```

Schema:
```json
{ "blanks": [
  { "sentence": "The ____ rises in the east.",
    "answer": "sun",
    "hint": "It's a star" }
]}
```

UI:
- Display sentence with input field.
- "Hint" button reveals the hint (penalty: -1 point).
- "Check" button compares case-insensitive trimmed input.
- Levenshtein distance ≤ 2 → partial credit.

Cache as `fill_blanks_<chapterId>`.

### G3 — Devil's Advocate

Custom AI prompt:
```
Generate 5 counter-arguments to ideas in this chapter.
For each: { topic, counter_argument, model_defense }
```

UI:
- Show topic + counter-argument.
- User types defense.
- Submit → AI evaluates against `model_defense`, gives score + feedback.
- Reveal button shows the model defense.

Reuses the conversation component (Phase C) for the eval response.

### G4 — Connections

AI generates 6 concept ↔ match pairs:
```json
{ "pairs": [
  { "concept": "Photosynthesis",
    "match": "Process of converting light into chemical energy" }
]}
```

UI:
- Two columns of buttons. Left: concepts. Right: shuffled matches.
- Click a concept → click a match.
- Correct pair fades out together with a green flash.
- Wrong pair shakes red and resets.
- Track wrong attempts; final score = pairs / (pairs + mistakes).

### G5 — Who Am I?

Riddles with 4 progressive clues:
```json
{ "riddles": [
  { "answer": "Recursion",
    "clues": [
      "I refer to myself.",
      "Mathematicians use me to define factorial.",
      "I always need a base case.",
      "fn(n) = n * fn(n-1)"
    ]
}]}
```

UI:
- Show first clue.
- "Need another clue" button reveals the next.
- Guess input.
- Score = max(1, 5 - cluesUsed). Wrong guesses cost 1 point each.

### G6 — Quiz Hub additions

The hub gets six mode buttons (was one). Best score per mode is
displayed.

Add "Generate More Questions" + "Regenerate" buttons (already
implemented in Phase B for classic; ensure they handle the new modes
too).

### G7 — Learning Hub view

Open from a button on the book detail.

```
.app.viewing-learninghub class shows .view-learninghub
```

Six game tiles:
- Cross-chapter quiz
- Weak-spot quiz
- Book debate
- Timeline challenge
- Explain simply
- Scenario sim

Each game has its own renderer + cache key.

### G8 — Cross-chapter quiz

`startLHCrossChapterQuiz()`:
- Generate 10 MC questions sampling from random chapters.
- Each question shows the source chapter title.
- Same UI as classic quiz.
- Cache as `lh_xchapter_<bookId>`.

### G9 — Weak-spot quiz

`startLHWeakSpotQuiz()`:
- Read all `quiz_scores_<chapterId>` rows for the book.
- Identify chapters with lowest best-score.
- Generate 5 questions per weak chapter focused on the topics that
  generated wrong answers.
- Run as a normal quiz session.

### G10 — Book debate

`startLHBookDebate()`:
- Devil's Advocate but spans the whole book.
- AI generates 5 cross-chapter counter-arguments.
- Otherwise identical to G3 flow.

### G11 — Timeline challenge

`startLHTimelineChallenge()`:
- AI extracts 6–10 chronologically-orderable events from the book.
- UI: shuffled cards.
- Drag-and-drop (HTML5 DnD on desktop, touch handlers on mobile).
- "Shuffle" + "Check" buttons.
- Correct order → green flash + score.
- Wrong → highlight cards out of place.

### G12 — Explain simply

`startLHExplainSimply()`:
- AI extracts 5 concepts from the book.
- For each, present at three difficulty levels:
  - 5-year-old explanation
  - 10-year-old explanation
  - 15-year-old explanation
- User selects which level matches their current understanding;
  game tracks comfort distribution.

### G13 — Scenario sim

`startLHScenarioSim()`:
- AI generates 5 hypothetical scenarios that test book principles.
- Each scenario has 3–4 multiple-choice resolutions.
- Selecting a resolution shows AI feedback explaining whether it
  aligns with the book's argument.

### G14 — Persistence

Each Learning Hub game has its own cache key:
```
lh_xchapter_<bookId>
lh_weak_<bookId>
lh_debate_<bookId>
lh_timeline_<bookId>
lh_explain_<bookId>
lh_scenario_<bookId>
```

Best scores tracked per game.

### G15 — Drag-and-drop helpers

For the timeline challenge:
- HTML5 DnD with `dragstart`, `dragover`, `drop`.
- Touch fallback: `touchstart`, `touchmove`, `touchend` translated to
  the same insertion logic.
- Visual feedback: dragged card opacity + drop zone highlight.

## Acceptance criteria

- [ ] All six chapter-level quiz modes generate, cache, and score.
- [ ] All six Learning Hub games launch and complete a play.
- [ ] Drag-and-drop works on iPad, Android, and desktop.
- [ ] Best scores persist and sync via Drive.
- [ ] Timeline challenge generates a cross-chapter event list (test
      with a non-fiction book that has a clear timeline).
- [ ] Weak-spot quiz correctly identifies the lowest-scored chapters
      and focuses on them.
- [ ] No mode breaks if the underlying chapter cache is missing —
      always offer a "Generate" button.

## Effort estimate

- **T-shirt:** L
- **Person-weeks:** 4–5
- **Critical path:** drag-and-drop + the five new generation prompts.

## Risks & unknowns

- **Mobile DnD** is fiddly. Reserve a day per mobile platform for
  polish.
- **Timeline event extraction** depends on the book having an actual
  timeline. For abstract / philosophical books the AI may struggle.
  Provide a "this book doesn't have clear chronology" empty state.
- **Generating 5 distinct quizzes per chapter** is API-quota heavy.
  Make each game opt-in and lazy-generated.

## Out of scope

- Spaced repetition scheduling (Phase N).
- Multiplayer quiz mode (Phase R).
- Quiz export to Anki / Quizlet (Phase N).

## Decision points before Phase H

- [ ] Confirm cache key naming for Learning Hub games.
- [ ] Decide whether weak-spot uses the open-ended scoring or only
      MC for cleaner signal.
- [ ] Decide whether to gate Learning Hub behind a minimum chapter
      count (e.g. ≥ 5 chapters).

---

Continue to [Phase H — Multi-Provider AI](phase-h-multi-provider-ai.md).

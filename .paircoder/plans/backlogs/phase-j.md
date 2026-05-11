# Sprint J: Advanced Quizzes & Learning Hub — 5 quiz modes + 6 cross-chapter games

> One task per T-item in `docs/implementation-plan/phase-j-advanced-quizzes.md` (G1–G15 in the source doc).
> Five new chapter-level quiz modes + a book-level Learning Hub with six cross-chapter games.

### Phase 1: New chapter-level quiz modes

### TJ.1 -- Speed Round | Cx: 8 | P1

**Description:** `startSpeedRound(chapter)`: sample 10 MC questions from cached pool (generate more if < 10). 15s per question. Visual progress bar. Selection auto-advances after 1.5s reveal. Score = correct/total + time bonus.

**AC:**
- [ ] 10-question round runs end-to-end
- [ ] Timer accurate ± 100ms
- [ ] Time bonus formula documented
- [ ] Best score saved via `saveQuizScore`

**Depends on:** TB.6

### TJ.2 -- Fill in the Blanks | Cx: 8 | P1

**Description:** Custom AI prompt extracts 8 sentences with key terms replaced by `____`. Each blank has answer + hint. UI: sentence with input; Hint button reveals hint (-1 point). Check button: case-insensitive trimmed comparison. Levenshtein distance ≤ 2 = partial credit.

**AC:**
- [ ] 8 sentences generate; cache `fill_blanks_<chapterId>`
- [ ] Hint reveals; penalty applied
- [ ] Levenshtein partial credit awarded
- [ ] Empty input shows validation

**Depends on:** TB.1, TB.4

### TJ.3 -- Devil's Advocate | Cx: 8 | P1

**Description:** Custom prompt generates 5 counter-arguments `{ topic, counter_argument, model_defense }`. UI: show topic + counter; user types defense; submit → AI evaluates against `model_defense`, gives score + feedback. Reveal button shows model defense. Reuses conversation component.

**AC:**
- [ ] 5 debates run end-to-end
- [ ] AI eval returns score + qualitative feedback
- [ ] Reveal works after submit
- [ ] Conversation component reused (no duplicate code)

**Depends on:** TC.2, TB.4

### TJ.4 -- Connections (matching) | Cx: 5 | P2

**Description:** 6 concept ↔ match pairs. Two columns of buttons (left: concepts, right: shuffled matches). Click concept then match: correct fades out with green flash; wrong shakes red and resets. Score = pairs / (pairs + mistakes).

**AC:**
- [ ] All 6 pairs render correctly
- [ ] Match logic correct (no false positives)
- [ ] Animation runs smoothly on mobile
- [ ] Score formula correct

**Depends on:** TB.4

### TJ.5 -- Who Am I? | Cx: 5 | P2

**Description:** Riddles with 4 progressive clues. UI: show first clue, "Need another clue" reveals next, guess input. Score = max(1, 5 - cluesUsed). Wrong guesses cost 1 point each.

**AC:**
- [ ] All 4 clues progressively revealed
- [ ] Score formula correct
- [ ] Wrong-guess penalty applied
- [ ] Cache `who_am_i_<chapterId>`

**Depends on:** TB.4

### TJ.6 -- Quiz Hub additions | Cx: 3 | P1

**Description:** Hub gets 6 mode buttons (was 1). Best score per mode displayed. "Generate More Questions" + "Regenerate" handle new modes.

**AC:**
- [ ] All 6 buttons present + linked
- [ ] Best scores displayed per mode
- [ ] More/Regenerate work for all 5 new modes
- [ ] Hub responsive on mobile

**Depends on:** TJ.1, TJ.2, TJ.3, TJ.4, TJ.5

### Phase 2: Learning Hub (book-level)

### TJ.7 -- Learning Hub view shell | Cx: 5 | P1

**Description:** Open from book detail. `.app.viewing-learninghub` class shows `.view-learninghub`. Six game tiles: Cross-chapter quiz, Weak-spot, Book debate, Timeline, Explain simply, Scenario sim.

**AC:**
- [ ] View opens from book detail
- [ ] All 6 tiles present
- [ ] Empty state per tile when not generated
- [ ] Best score badge per game

**Depends on:** TI.4

### TJ.8 -- Cross-chapter quiz | Cx: 5 | P1

**Description:** `startLHCrossChapterQuiz()`: generate 10 MC sampling from random chapters. Show source chapter title per question. Same UI as classic quiz. Cache `lh_xchapter_<bookId>`.

**AC:**
- [ ] 10 questions span at least 5 chapters
- [ ] Source chapter visible per question
- [ ] Cache works
- [ ] Standard scoring

**Depends on:** TJ.7

### TJ.9 -- Weak-spot quiz | Cx: 8 | P1

**Description:** `startLHWeakSpotQuiz()`: read all `quiz_scores_<chapterId>` rows; identify lowest-best-score chapters; generate 5 questions per weak chapter focused on wrong-answer topics. Standard quiz UI.

**AC:**
- [ ] Lowest-scored chapters correctly identified
- [ ] Wrong-topic targeting verified on fixture
- [ ] Falls back gracefully when no quiz history exists
- [ ] Cache `lh_weak_<bookId>`

**Depends on:** TJ.7

### TJ.10 -- Book debate | Cx: 5 | P2

**Description:** Devil's Advocate over the whole book. AI generates 5 cross-chapter counter-arguments. Identical to TJ.3 flow.

**AC:**
- [ ] 5 debates run
- [ ] Cross-chapter context preserved
- [ ] Cache `lh_debate_<bookId>`

**Depends on:** TJ.3, TJ.7

### TJ.11 -- Timeline challenge (DnD) | Cx: 13 | P1

**Description:** AI extracts 6–10 chronologically-orderable events. UI: shuffled cards. HTML5 DnD on desktop, touch handlers on mobile. Shuffle + Check buttons. Correct order → green flash + score. Wrong → highlight cards out of place.

**AC:**
- [ ] DnD works on iPad, Android, desktop (manual)
- [ ] Touch fallback reaches insertion logic
- [ ] Visual feedback: opacity + drop-zone highlight
- [ ] Empty state when book has no chronology
- [ ] Cache `lh_timeline_<bookId>`

**Depends on:** TJ.7

### TJ.12 -- Explain simply | Cx: 5 | P2

**Description:** AI extracts 5 concepts. For each: 5/10/15-year-old explanation. User selects which level matches understanding; game tracks comfort distribution.

**AC:**
- [ ] All 3 levels render per concept
- [ ] Comfort distribution chart shown after 5 concepts
- [ ] Cache `lh_explain_<bookId>`

**Depends on:** TJ.7

### TJ.13 -- Scenario sim | Cx: 5 | P2

**Description:** AI generates 5 hypothetical scenarios testing book principles. 3–4 MC resolutions per scenario. Selecting resolution shows AI feedback explaining alignment with book argument.

**AC:**
- [ ] 5 scenarios run end-to-end
- [ ] AI feedback returned per resolution
- [ ] Cache `lh_scenario_<bookId>`

**Depends on:** TJ.7

### Phase 3: Persistence + helpers

### TJ.14 -- Per-game cache keys + best-score persistence | Cx: 3 | P1

**Description:** Cache keys: `lh_xchapter_<bookId>`, `lh_weak_<bookId>`, `lh_debate_<bookId>`, `lh_timeline_<bookId>`, `lh_explain_<bookId>`, `lh_scenario_<bookId>`. Best scores tracked per game.

**AC:**
- [ ] All 6 cache keys persist
- [ ] Best scores synced via Drive (F)
- [ ] No collision with chapter-level quiz keys

**Depends on:** TJ.8, TJ.9, TJ.10, TJ.11, TJ.12, TJ.13

### TJ.15 -- DnD helpers (timeline) | Cx: 5 | P1

**Description:** HTML5 DnD with `dragstart`, `dragover`, `drop`. Touch fallback: `touchstart`, `touchmove`, `touchend` translated to same insertion logic. Visual feedback: opacity + drop-zone highlight.

**AC:**
- [ ] Touch and mouse paths produce identical state changes
- [ ] No double-trigger
- [ ] Vitest covers insertion logic (mocking events)

**Depends on:** TJ.11

---

## Sprint enforcement gates (must pass before Sprint K begins)

- [ ] **G-AC** — all task AC ticked
- [ ] **G-Manual** — Real-device DnD test on iPad + Android
- [ ] **G-Tests** — coverage ≥ 86%; DnD insertion logic ≥ 90%
- [ ] **G-State** — `state.md` updated

**Decision points before Sprint K:**

- [ ] Confirm cache key naming for Learning Hub games
- [ ] Decide weak-spot scoring: open-ended or MC-only (cleaner signal)
- [ ] Gate Learning Hub on min chapter count (e.g. ≥ 5)?

# Sprint P: Writing Exercises — 6 types + persistence + AI feedback

> One task per T-item in `docs/implementation-plan/phase-p-writing-exercises.md` (T1–T12 in source doc).
> Six interactive writing exercise types with PERSISTED responses (TC discarded them) and AI feedback.

### Phase 1: Data + generator + shell

### TP.1 -- WritingExercise interface + Dexie store | Cx: 5 | P0

**Description:** zod schema for `WritingExercise`. Store `writing_exercises`. Dexie migration.

**AC:**
- [ ] Schema covers all 6 exercise types
- [ ] Migration applies cleanly
- [ ] Vitest covers schema

**Depends on:** TH.1

### TP.2 -- generateExercise() helper | Cx: 5 | P0

**Description:** Single Gemini call per exercise. Returns typed payload per `type`.

**AC:**
- [ ] All 6 types generate
- [ ] zod-validated output
- [ ] Error handling per type

**Depends on:** TB.1, TP.1

### TP.3 -- ExerciseView shell | Cx: 5 | P1

**Description:** Modal overlay with hint reveal, submit, response area, confetti slot.

**AC:**
- [ ] Modal traps focus
- [ ] Accessible (aria-live for hints)
- [ ] Submit disabled until inputs valid

**Depends on:** TP.1

### Phase 2: Six exercise UIs

### TP.4 -- Six type-specific UIs | Cx: 21 | P0

**Description:** Implement: `fill_blanks`, `expand_outline`, `rewrite_ai`, `connect_concepts`, `citation_practice`, `argument_builder`. Each a small component.

**AC:**
- [ ] All 6 render with their unique UI
- [ ] Inputs validated per type
- [ ] Vitest covers each render + state transition
- [ ] Mobile-friendly per type

**Depends on:** TP.3

### TP.5 -- Hint system | Cx: 3 | P1

**Description:** Reveal on demand; increment `hintsUsed` counter. Penalty in scoring.

**AC:**
- [ ] Up to 3 hints per exercise
- [ ] Counter persists with response
- [ ] Penalty documented

**Depends on:** TP.3

### TP.6 -- Submit handler | Cx: 8 | P0

**Description:** Assembles per-type response string, persists to `writing_exercises` store. **THIS IS THE TC BUG FIX** — TC threw responses away.

**AC:**
- [ ] All 6 types serialize cleanly
- [ ] Response includes input, hint count, AI feedback, score, timestamp
- [ ] Vitest round-trips each type
- [ ] No data loss on rapid submit

**Depends on:** TP.4

### Phase 3: Polish + stats + settings + sync

### TP.7 -- Confetti (CSS-based + reduced-motion) | Cx: 3 | P2

**Description:** CSS-based animation. Respects `prefers-reduced-motion`.

**AC:**
- [ ] Confetti renders on submit
- [ ] Reduced-motion: no animation; static "Nice!" badge
- [ ] No layout shift

**Depends on:** TP.6

### TP.8 -- Stats card on dashboard | Cx: 5 | P1

**Description:** Query `writing_exercises` for current project. Display count, average score, streak.

**AC:**
- [ ] Stats reactive (LiveQuery)
- [ ] Empty state when no exercises
- [ ] Filters by exercise type

**Depends on:** TO.3, TP.6

### TP.9 -- Per-section past-exercises panel | Cx: 5 | P1

**Description:** In `SectionEditor`, show panel of past exercises tied to current section.

**AC:**
- [ ] Lists past exercises with timestamp + score
- [ ] Click expands full response + AI feedback
- [ ] Empty state

**Depends on:** TO.5, TP.6

### TP.10 -- Settings (exercisePreferences_<projectKind>) | Cx: 3 | P2

**Description:** Default exercise types per project kind.

**AC:**
- [ ] Persisted per kind
- [ ] Validation on types
- [ ] Defaults sensible

**Depends on:** TA.8

### TP.11 -- Drive sync (writing_exercises) | Cx: 3 | P0

**Description:** Add to envelope.

**AC:**
- [ ] Round-trip preserves all 6 types
- [ ] Backward compat: missing field handled

**Depends on:** TF.7, TP.1

### TP.12 -- Tests | Cx: 5 | P1

**Description:** Vitest unit tests on per-type response assembly. e2e: trigger exercise from section editor → submit → see in stats card.

**AC:**
- [ ] Coverage ≥ 86%
- [ ] e2e green
- [ ] Each exercise type has a fixture

**Depends on:** TP.11

---

## Sprint enforcement gates (must pass before Sprint Q begins)

- [ ] **G-AC** — all task AC ticked
- [ ] **G-Tests** — per-type assembly ≥ 90%
- [ ] **G-Migrate** — write_exercises store cleanly added
- [ ] **G-State** — `state.md` updated

**Decision points before Sprint Q:**

- [ ] Streaks across exercises (yes/no)
- [ ] Confetti for all 6 types or only argument_builder

# Phase P — Writing Exercises

## Goal

Add six interactive writing exercise types to the Writing Hub
(`fill_blanks`, `expand_outline`, `rewrite_ai`, `connect_concepts`,
`citation_practice`, `argument_builder`), with **persistence** for user
responses and AI feedback (which TC discarded).

## Why this phase

ThesisCraft's exercise system was the most polished part of the app —
six bespoke UIs with confetti rewards. But responses were never written
to storage, so users couldn't review past exercises or build a streak
across them. Phase P fixes this and integrates with the merged project
model.

## Prerequisites

- Phase G (Architectural Rebuild)
- Phase H (Multi-Project Workspaces)
- Phase O (Writing Hub) — exercise launcher buttons live there

## Deliverables

1. New IDB store `writing_exercises` (Phase P writes; TC never wrote).
2. `<ExerciseView>` overlay component with 6 type-specific inner UIs.
3. Generator: `generateExercise(model, sectionTitle, type,
   sectionDescription, projectContext)` (Gemini, JSON mode).
4. Submission flow: persist `userResponse` → call Gemini for feedback →
   persist `aiFeedback` → mark `completed: true`.
5. **Persistence** — every step writes to IDB so refresh doesn't lose work.
6. Confetti animation that respects `prefers-reduced-motion` (TC bug
   fix: TC didn't honor this).
7. Stats card on Writing Hub Dashboard: exercises completed today /
   week / total.
8. Per-section list of past exercises in section detail view (Phase P
   follow-up).
9. Drive sync envelope extension to include `writing_exercises`.

## Task breakdown

- **T1**: Define `WritingExercise` interface; Dexie store + migration.
- **T2**: Generator helper `generateExercise()` — single Gemini call,
  JSON mode, max 4096 tokens, temperature 0.7. Per-type prompt
  templates.
- **T3**: `<ExerciseView>` shell — modal overlay with hint reveal,
  submit button, confetti container.
- **T4**: 6 type-specific UIs:
  - `FillBlanksUI` — splits prompt on `[___]`, inline inputs
  - `ExpandOutlineUI` — bullet box + textarea
  - `RewriteAiUI` — reference text + textarea
  - `ConnectConceptsUI` — concept chip grid + textarea
  - `CitationPracticeUI` — APA cheat sheet + claims + textarea
  - `ArgumentBuilderUI` — 3-step wizard
- **T5**: Hint system — reveal on demand, increment `hintsUsed` counter,
  persist on each reveal.
- **T6**: Submit handler — assembles per-type response string, persists
  `userResponse`, calls Gemini for feedback (3-5 sentence tutor reply),
  persists `aiFeedback`, marks `completed: true`, `completedAt`,
  `hintsUsed`.
- **T7**: Confetti — Phase P uses CSS-based animation, respects
  `prefers-reduced-motion`. 30 squares, 6 colors, 2-3.5s duration.
- **T8**: Stats card on dashboard — query `writing_exercises` for
  today / week / total counts. Tap-through to a per-section list.
- **T9**: Per-section past-exercises panel in `SectionEditor` (Phase P
  follow-up).
- **T10**: Settings: `exercisePreferences_<projectKind>` for default
  type rotation per kind.
- **T11**: Drive sync envelope extension (`writing_exercises` array).
- **T12**: Tests — Vitest unit tests on per-type response assembly,
  generator prompt builders. Playwright e2e for "generate exercise →
  reveal hint → submit → see feedback → close → reopen → see persisted
  state".

## Acceptance criteria

- A user can launch any of the 6 exercise types from the Writing Hub
  Dashboard or Section Editor.
- Their response and AI feedback are persisted on submit; closing and
  reopening the exercise shows the same response and feedback.
- The streak counter increments only on `completed: true` exercises (not
  just on `started`).
- The dashboard stats card shows accurate counts (today / week / total).
- Confetti respects `prefers-reduced-motion` (no animation when set).
- Drive sync round-trips exercises across devices.
- Tests pass; ≥ 80 % coverage on per-type response assembly.

## Effort estimate

- T-shirt: **M**
- Person-weeks: **3–4**

## Risks & unknowns

- **Hint reveal UX** — TC reveals one at a time; some users may want
  all at once. Phase P preserves TC behavior; configurable in Settings
  follow-up.
- **AI feedback quality** — depends on prompt; tune based on user
  feedback. Settings expose `prompt_exerciseFeedback` override.
- **Cross-language exercise content** — for `language: 'sl'` projects,
  the generator needs Slovenian output. Pass `project.language` into
  the generator prompt explicitly.

## Out of scope

- Spaced repetition for exercises — Phase T's spaced repetition is for
  flashcards; exercise SR is a Phase Y candidate.
- Cross-project exercise stats — Phase X
- Exercise sharing / templates — Phase Y

## Decision points (revisit before Phase Q)

- ⚠ Should completed exercises be deletable? Decision: yes, with a
  confirm dialog. Don't auto-delete.
- ⚠ Hint reveal cap — TC has no cap. Phase P caps at all hints
  available (typically 3); track `hintsUsed` for stats only.

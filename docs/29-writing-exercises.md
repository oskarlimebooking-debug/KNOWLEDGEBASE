# 29 — Writing Exercises

Writing Exercises are interactive, AI-generated drills that help the user
practise specific writing skills (academic citations, building arguments,
expanding outlines, rewriting AI text in their own voice, connecting
concepts, filling structured blanks).

> Implemented in Phase P (`implementation-plan/phase-p-writing-exercises.md`).
> Adopted from ThesisCraft's `ExerciseView` with **persistence** (TC
> discarded responses on close — Headway saves them) and integration with
> the project model.

---

## When and how exercises appear

Three entry points:

1. **Writing Hub Dashboard** → "Today's exercise" card → tap to open.
2. **Section Editor** → "Exercise" toolbar button → generates exercise
   tied to that specific section.
3. **Section detail view** → "All exercises for this section" list (Phase P
   follow-up; surfaces past completed exercises for review).

---

## Six exercise types

| Type | Purpose | UI |
|---|---|---|
| `fill_blanks` | Practice precise language: fill in `[___]` placeholders | Inline `<input>` between text segments |
| `expand_outline` | Turn bullet points into full paragraphs | Bullet box + textarea |
| `rewrite_ai` | Reword AI text in user's voice | Reference text + textarea |
| `connect_concepts` | Articulate relationships between concepts | Concept chips grid + textarea |
| `citation_practice` | Practice APA in-text citations | APA cheat sheet + claims list + textarea |
| `argument_builder` | Build claim → evidence → reasoning | 3-step wizard (one textarea per step) |

---

## Data model

### `writing_exercises` IDB store (new in Phase P, fixes TC bug)

```ts
interface WritingExercise {
  id: string;                  // "ex_<ts>"
  projectId: string;           // links to active project
  sectionId: string;           // links to a section of the project
  type: 'fill_blanks' | 'expand_outline' | 'rewrite_ai'
      | 'connect_concepts' | 'citation_practice' | 'argument_builder';
  prompt: string;              // for fill_blanks contains "[___]" tokens
  hints: string[];             // shown one at a time
  sampleAnswer?: string;       // never shown to user, only used in feedback prompt
  userResponse?: string;       // ✓ NOW PERSISTED (TC: discarded)
  aiFeedback?: string;         // ✓ NOW PERSISTED (TC: discarded)
  completed: boolean;
  startedAt: string;           // ISO
  completedAt?: string;        // ISO
  hintsUsed: number;
}
```

ThesisCraft had this interface but **never wrote to the store**. Headway's
Phase P writes on:
- Exercise generation (initial state with `completed: false`)
- Each user submission (`userResponse`, `aiFeedback`, `completed: true`,
  `completedAt`)

This unlocks:
- "You completed 12 exercises this week" stats
- Review of past exercises by section
- Streak counting across exercises
- Cross-project exercise stats in Settings

### Generator prompt

`generateExercise(model, sectionTitle, type, sectionDescription, projectContext)`
calls Gemini in JSON mode. The response shape for each type:

```jsonc
// fill_blanks
{
  "prompt": "Job crafting refers to [___] employees make to their work...",
  "hints": ["Think about behavioural changes", "Two-word noun"],
  "sampleAnswer": "the proactive changes"
}

// expand_outline
{
  "prompt": "- Definition of self-determination theory\n- Three innate needs\n- Connection to intrinsic motivation",
  "hints": ["Start with Deci & Ryan's definition", "Use a literature-grounded tone"],
  "sampleAnswer": "Self-determination theory (Deci & Ryan, 2000) posits..."
}

// rewrite_ai
{
  "prompt": "AI Reference Text: <draft paragraph>",
  "hints": ["Avoid clichés like 'in today's world'", "Keep technical terms intact"],
  "sampleAnswer": "<rewritten paragraph>"
}

// connect_concepts
{
  "prompt": "Job crafting\nAutonomy\nIntrinsic motivation\nSales performance",
  "hints": ["Use a mediation framework", "Cite ≥1 prior empirical link"],
  "sampleAnswer": "Job crafting may enhance autonomy, which in turn..."
}

// citation_practice
{
  "prompt": "Claim 1: Job crafting predicts higher engagement.\nClaim 2: Engagement predicts performance.\nFind appropriate citations and rewrite each with in-text APA.",
  "hints": ["Use Tims et al. or Bakker for engagement", "Don't cite review articles for empirical claims"],
  "sampleAnswer": "Job crafting predicts higher engagement (Tims et al., 2012)..."
}

// argument_builder
{
  "prompt": "Argument: Salespeople with high autonomy benefit more from job crafting than those without.",
  "hints": ["State the claim clearly", "Bring in moderation theory"],
  "sampleAnswer": "<full claim/evidence/reasoning structure>"
}
```

Temperature: 0.7. Max tokens: 4096.

---

## Per-type UIs

### `fill_blanks`

Splits `prompt` on `[___]` and renders parts as text with inline `<input>`
between each pair. State stored in `blankInputs: Record<number, string>`.
On submit, joins parts with the user's blanks back into a single string
for the feedback call.

### `expand_outline`

The bullet-point prompt rendered in a code-block style box with a single
textarea below. Tabbing into the textarea preserves bullet structure for
reference.

### `rewrite_ai`

Same layout as `expand_outline` but the prompt is labelled "AI Reference
Text" with coral border accents. The textarea has a placeholder: "Rewrite
in your own voice…"

### `connect_concepts`

`prompt` is split on `\n` into 4–6 concept chips arranged in a 2-column
grid (teal background, dark text). Below: a single textarea with
placeholder "Articulate the relationships…"

### `citation_practice`

A persistent APA cheat-sheet panel above the prompt:

```
In-text:  (Author, Year) or Author (Year)
Multiple: (Author1, Year; Author2, Year)
Reference: Author, A. A. (Year). Title. Journal, Vol(Issue), pp-pp. doi
```

Below: numbered claims with their own input rows, plus a final textarea
for the assembled response.

### `argument_builder`

A 3-step wizard: **Claim → Evidence → Reasoning**. Step indicator strip at
the top. Only one textarea is shown at a time. Each "Next →" button is
disabled until the current step's text is non-empty. Completed steps get
a green checkmark.

The final submission concatenates the three with labelled headers:

```
Claim: <step1>
Evidence: <step2>
Reasoning: <step3>
```

---

## Hints

Hints reveal one at a time. `hintsShown` counter increments per click.
Each revealed hint animates in with a subtle highlight. Phase P tracks
`hintsUsed` in the persisted exercise so stats reflect it.

---

## Submission flow

`handleSubmit`:

1. Builds a single `response` string per type (per-type assembly logic).
2. Persists `userResponse` to IDB (so refresh doesn't lose it).
3. Sends to Gemini:
   ```
   You are an academic writing tutor. The student completed a "{type}" exercise.
   Exercise prompt: {prompt}
   Student response: {response}
   Sample answer for reference: {sampleAnswer}

   Provide brief, constructive feedback (3-5 sentences). Be encouraging
   but specific about improvements. Focus on academic writing quality
   and the student's mastery of {project.writingStyle} tone.
   ```
   `temperature: 0.7`, `maxTokens: 1024`.
4. Sets `aiFeedback` state and persists.
5. Marks `completed: true`, `completedAt: now`, `hintsUsed: ...`.
6. Renders feedback inside a coral GlassCard.
7. **Confetti animation**: 30 small colored squares fall from random x
   positions over 2–3.5 seconds (six colors cycled) — visual reward only.

Closing the modal preserves all data (TC discarded everything).

---

## Stats and review

Phase P follow-up: a stats card in the dashboard surfaces:

- Exercises completed today / this week / total
- Average AI feedback sentiment (basic keyword classifier on `aiFeedback`)
- Most-attempted exercise type
- Sections with most/least exercises

Tap-through: per-section list of past exercises with date, type, hints
used, and a "Show feedback" toggle.

---

## Cost

Each exercise = 1 Gemini call (generation) + 1 Gemini call (feedback).
Cheap. No streaming. Single button press = ≤ 2 paid calls.

The dashboard's "Today's exercise" generates lazily (only on first view of
the day), so it doesn't burn tokens for users who never engage with it.

---

## Known good defaults

- Per-section preferred exercise types: read from
  `settings.exercisePreferences_<projectKind>`. Defaults:
  - `thesis` → favour `expand_outline`, `citation_practice`, `argument_builder`
  - `article` → favour `rewrite_ai`, `connect_concepts`, `argument_builder`
  - `book` → favour `fill_blanks`, `expand_outline`
  - `custom` → uniform random across all 6
- Hint reveal cap: 3 (matches TC).

---

## Continue reading

- The Writing Hub that hosts these: [`28-writing-hub.md`](28-writing-hub.md)
- Project model with `writingStyle` and `kind`: [`26-projects-and-research-workspaces.md`](26-projects-and-research-workspaces.md)
- AI provider integration (Gemini): [`16-ai-providers.md`](16-ai-providers.md)

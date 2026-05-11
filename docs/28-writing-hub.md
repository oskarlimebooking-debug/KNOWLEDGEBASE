# 28 — Writing Hub

The Writing Hub is a top-level pillar (sibling of Library and Discovery)
for the WRITE phase of the merged app. It edits a project's outline,
generates streaming AI drafts per section, tracks word-count progress, and
hosts interactive writing exercises.

> Implemented in Phase O (`implementation-plan/phase-o-writing-hub.md`).
> Adopted from ThesisCraft's Writing module with bug fixes (apiKey
> propagation, unused `writingStyle` setting), exercise persistence
> (Phase P), and integration with the merged data model.

---

## Three screens

```
┌────────────────────────────────────────┐
│  Writing Hub Dashboard                 │ ← progress ring, today's exercise
│   (when a project is active)           │   recent activity, motivation
└──────────────┬─────────────────────────┘
               │  tap "Outline"
               ▼
┌────────────────────────────────────────┐
│  Outline Tree                          │ ← collapsible 2-level tree of
│   (sections of the active project)     │   sections with status dots
└──────────────┬─────────────────────────┘
               │  tap a leaf section
               ▼
┌────────────────────────────────────────┐
│  Section Editor                        │ ← three-panel writing surface
│   AI Draft │ Your Writing │ Toolbar    │   with streaming AI generation
└────────────────────────────────────────┘
```

Disabled when **no active project** — the top nav hides "Writing" and
shows "Create your first project →" CTA in its place.

---

## Dashboard (`WritingHubDashboard`)

### Computed metrics

```ts
const sections          = await dbGetByIndex('project_sections', 'projectId', activeProjectId);
const leafSections      = sections.filter(s => !sections.some(c => c.parentId === s.id));
const totalWords        = sections.reduce((sum, s) => sum + s.wordCount, 0);
const totalTarget       = leafSections.reduce((sum, s) => sum + s.targetWords, 0);
const completedSections = sections.filter(s => s.status === 'final').length;
const overallProgress   = totalTarget > 0 ? Math.min(totalWords / totalTarget, 1) : 0;
```

The leaf-only target sum is intentional (parent chapters have
`targetWords: 0`, their effective target is the sum of children).

### Daily streak

Computed from unique `lastEdited` dates (`toDateString()`) across this
project's sections, walking backward day-by-day until a gap. Editing on
consecutive days extends the streak; skipping resets it.

This is **per-project** — a global cross-project streak is offered as an
option in Settings (Phase T).

### Today's exercise

`generateRandomExercise()` picks:

1. A random unfinished leaf section: `s.status !== 'final' && s.targetWords > 0`.
2. A random `WritingExercise['type']` from the six options.
3. Calls `generateExercise(model, sectionTitle, type, sectionDescription)`.

Tapping the card opens the `<ExerciseView>` overlay. See
[`29-writing-exercises.md`](29-writing-exercises.md) for exercise details
and persistence (which Headway fixes — TC discarded responses on close).

### Recent activity

Top 5 sections sorted by `lastEdited` desc. Each row: status dot, title,
word count, "Xm/h/d ago". Tapping a row deep-links to that section's
editor (TC required two taps; Headway one).

### Motivational tip

A single random pick from a hard-coded `MOTIVATIONAL_TIPS` array (10
strings). Picked once on mount.

---

## Outline (`OutlineTree`)

Two-level collapsible tree. Top-level sections render with chevrons,
children indent under them with smooth height transitions.

### Status indicators

| Status | Dot | Bar |
|---|---|---|
| `not_started` | gray | gray-40 % |
| `in_progress` | blue | blue |
| `draft` | yellow | yellow |
| `review` | orange | orange |
| `final` | green | green |

### Per-section progress bar

For leaf sections: `wordCount / targetWords`.
For parent chapters: sum of children's `wordCount` over sum of children's
`targetWords`.

### Auto-expand on mount

Every parent that has children is expanded by default — no chrome to fight
with.

### Reordering

Phase O initial: read-only order from `section.order`.
Phase O follow-up: drag-and-drop reorder within siblings; updates `order`
fields and re-saves.

### Tap behaviour

- Parent → toggle expand/collapse.
- Leaf → open `<SectionEditor section={...}>` as a full-screen view.

---

## Section Editor (`SectionEditor`)

A focused per-section writing surface. Two stacked editor panels, plus a
toolbar.

### State

```ts
const [content, setContent]               = useState(section.content);
const [aiDraft, setAiDraft]               = useState(section.aiDraft);
const [status, setStatus]                 = useState(section.status);
const [generating, setGenerating]         = useState(false);
const [streamedText, setStreamedText]     = useState('');
const [saved, setSaved]                   = useState(false);
const [exercise, setExercise]             = useState<WritingExercise | null>(null);
const [showExercise, setShowExercise]     = useState(false);
const [generatingExercise, setGeneratingExercise] = useState(false);
const debounceRef = useRef<NodeJS.Timeout | null>(null);
const abortRef    = useRef<AbortController | null>(null);
```

### Word count

Computed inline: `content.trim() ? content.trim().split(/\s+/).length : 0`.
Phase O follow-up adds:
- Multilingual word boundary handling (`Intl.Segmenter`, falls back to
  whitespace split).
- Memoization: only recompute when `content` actually changes.

### Auto-save (debounced)

```ts
useEffect(() => {
  if (debounceRef.current) clearTimeout(debounceRef.current);
  debounceRef.current = setTimeout(() => {
    if (content !== section.content || status !== section.status) {
      doSave();
    }
  }, 1500);
  return () => clearTimeout(debounceRef.current);
}, [content, status, ...]);
```

After 1500 ms of inactivity, calls `dbPut('project_sections', { ...section,
content, aiDraft, status, wordCount, lastEdited: now })` and shows a
green "Saved" pill for 2 seconds.

### Streaming AI draft (`handleGenerateDraft`)

This is the most complex flow in the merged Writing pillar. It demonstrates
how to stream NDJSON from a Vercel Edge Function back into the UI.

#### Prompt construction

Headway **fixes the unused `writingStyle` bug** by injecting it explicitly:

```ts
const project       = await dbGet('projects', activeProjectId);
const allSections   = await dbGetByIndex('project_sections', 'projectId', project.id);
const outline       = allSections.map(s => `${s.number}. ${s.title}`).join('\n');
const sources       = await getRelatedSources(section);   // (Phase Q deepens this)
const references    = sources.map(s => `${s.authors} (${s.year}). ${s.title}. ${s.abstract}`).join('\n\n');

const prompt = `You are an academic writing assistant helping write a ${project.kind}
in ${project.language}. The writing style should be ${project.writingStyle}.

Section: ${section.number} ${section.title}
Project outline:
${outline}

${section.description ? `Section brief: ${section.description}` : ''}

${content ? `Existing content to build upon:\n${content}\n` : ''}

Relevant sources:
${references || 'No specific sources linked yet.'}

${project.hypotheses?.length ? `Project hypotheses (use as context, do not just restate):\n${project.hypotheses.join('\n')}\n` : ''}

Write a well-structured draft for this section. Use:
- Tone: ${project.writingStyle}
- Clear topic sentences for each paragraph
- Citations in APA format (Author, Year) where references are available
- Logical flow between paragraphs
- Critical analysis, not just description

Do NOT include the section heading itself. Start directly with the content.`;
```

#### Stream handling

Headway **fixes the missing `apiKey` bug** by always including it:

```ts
const res = await fetch('/api/generate/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    apiKey: settings.geminiApiKey,           // ← FIXED (TC omitted this)
    prompt,
    model: settings.geminiModel,
    temperature: 0.6,
    maxTokens: Math.min(8192, settings.contextWindow),
  }),
  signal: controller.signal,
});

const reader = res.body!.getReader();
const decoder = new TextDecoder();
let accumulated = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value, { stream: true });
  const lines = chunk.split('\n').filter(l => l.trim());
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.token) {
        accumulated += parsed.token;
        setStreamedText(accumulated);
      }
    } catch { /* malformed line — skip silently */ }
  }
}
setAiDraft(accumulated);
setStreamedText('');
```

See [`33-streaming-ai-and-ndjson.md`](33-streaming-ai-and-ndjson.md) for
the streaming protocol and Vercel route.

#### Cancellation

`abortRef = new AbortController()` is created per click. A subsequent click
first aborts the previous controller, then creates a new one. On unmount,
`useEffect` cleanup aborts any in-flight stream. The catch block silently
returns on `AbortError`.

#### "Use as Base" button

A small button on the AI Draft panel that copies `aiDraft → content`,
overwriting what's there. Useful for "AI scaffold, then revise."

Phase O follow-up: a "merge" mode that opens a diff view between current
content and AI draft, letting the user pick paragraph-by-paragraph.
Phase Q (Citations) adds a step that auto-extracts citations from the AI
draft into the project's bibliography.

### Status selector

A small dropdown in the toolbar with the five statuses. Changing status
auto-saves immediately (no debounce wait).

### Section description editor

The `description` field is shown inline in the toolbar with an edit icon.
Used as context for both draft generation and exercise generation.

---

## Markdown editor (Phase O follow-up)

Initial Phase O ships a plain `<textarea>` (mirrors TC's pattern, gets the
flow working). Phase O follow-up upgrades to a Markdown editor (TipTap or
Lexical) with:

- Bold / italic / lists / headings
- Inline citation slash command: `/cite` opens the Citation Picker (Phase Q)
- Footnote support
- LaTeX math via KaTeX
- Live word count without reflow

The plain content field stays Markdown — no schema migration needed when
the editor upgrades.

---

## Related sources panel

Lists Sources where `relatedSourceIds` includes this section's ID. Each
row shows authors, year, title; tapping opens the Source in a side panel.

Phase O ships a static read-only list. Phase Q adds the **Add source**
picker UI (TC had `relatedArticleIds` in the data model but no UI to write
to it — Headway fixes).

---

## Section linking via outline context

When a section is generated, its prompt includes the **full outline** so
the AI knows neighbouring sections. This avoids:

- Repetition of content already covered in earlier sections.
- Missing connections to hypotheses introduced in chapter 6.
- Misplaced motivational/literature/conclusion content.

The outline is sent as numbered text only; full content of other sections
is **not** included (would explode the context window).

---

## Auto-resume

The Writing Hub remembers the last opened section per project. Reopening
the Writing Hub on a fresh tab takes you straight back to that section.

Stored as `settings.writing_lastSectionId_<projectId>` (mirrors the
`pdf_rotation_<bookId>_<page>` pattern).

---

## Notable improvements over ThesisCraft

| Issue in TC | Headway fix |
|---|---|
| Streaming endpoint called without `apiKey` (broken) | Always sent in request body |
| `writingStyle` setting unused in prompts | Injected into draft prompt template |
| No section versioning | Phase O follow-up adds `aiDraft_history[]` (last 5 generations) |
| `relatedArticleIds` had no UI to populate it | Phase Q adds Citation Picker |
| Plain `<textarea>` only | Phase O follow-up: TipTap/Lexical Markdown editor |
| Whole content sent to draft prompt regardless of size | Phase O caps content at 4 K chars; long sections summarized first |

---

## Continue reading

- Writing exercises (the six exercise types): [`29-writing-exercises.md`](29-writing-exercises.md)
- Citations and the Citation Picker: [`30-citations-and-sources.md`](30-citations-and-sources.md)
- Streaming protocol: [`33-streaming-ai-and-ndjson.md`](33-streaming-ai-and-ndjson.md)
- Project model: [`26-projects-and-research-workspaces.md`](26-projects-and-research-workspaces.md)

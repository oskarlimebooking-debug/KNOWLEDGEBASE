# Phase O — Writing Hub

## Goal

Build a top-level Writing pillar with three screens (Dashboard, Outline,
Section Editor) that lets the user edit a project's outline, generate
streaming AI drafts per section, track progress, and trigger writing
exercises.

## Why this phase

ThesisCraft's Writing Module was its other distinctive feature
(alongside Discovery). The merged Headway absorbs it but fixes the
known bugs (streaming endpoint missing apiKey, unused `writingStyle`
setting, no exercise persistence) and integrates with the merged
project / source / citation model.

The streaming AI draft flow — NDJSON over fetch + AbortController
cancellation — is the single most complex flow in the WRITE pillar.

## Prerequisites

- Phase G (Architectural Rebuild)
- Phase H (Multi-Project Workspaces) — projects + sections live
- Phase K (Multi-Provider AI) — Gemini available

## Deliverables

1. New top-level `/writing` route (hidden in no-project mode, replaced by
   "Create your first project →" CTA).
2. `WritingHubDashboard` — overall progress ring, today's exercise card,
   recent activity, motivational tip.
3. `OutlineTree` — collapsible 2-level tree with status dots, per-section
   progress bars, drag-reorder.
4. `SectionEditor` — toolbar + AI Draft panel + Your Writing panel,
   auto-save debounced 1.5 s.
5. **Streaming AI draft generation** via NDJSON, with AbortController
   cancellation. Apikey **always sent** (TC bug fix).
6. **`writingStyle` injected** into the draft prompt template (TC bug
   fix).
7. Outline-aware prompts (full numbered outline included as context;
   neighbouring section content NOT included).
8. "Use as Base" button copies AI Draft → Your Writing.
9. Status selector (5 statuses: not_started → in_progress → draft →
   review → final), auto-save on change.
10. Auto-resume to last opened section per project.
11. Vercel `/api/generate/stream.ts` route (Node.js runtime).

## Task breakdown

- **T1**: Define `useWritingStore` (Zustand) — current section, content,
  aiDraft, streamedText, saved, generating, exercise state.
- **T2**: `/writing` route + redirect logic for no-project mode.
- **T3**: `WritingHubDashboard` — read sections via Dexie LiveQuery,
  compute leafSections / totalWords / totalTarget / dailyStreak,
  generate today's exercise on first view of the day.
- **T4**: `OutlineTree` — collapsible tree of sections, status colors,
  per-section progress bar, auto-expand parents on mount.
- **T5**: `SectionEditor` shell — three-panel layout, toolbar with
  Generate Draft / Exercise / status selector / word count.
- **T6**: Auto-save: debounce 1.5 s; show green "Saved" pill for 2 s
  on success.
- **T7**: NDJSON streaming protocol — see [`33-streaming-ai-and-ndjson.md`](../33-streaming-ai-and-ndjson.md)
  for full spec.
- **T8**: Vercel route `/api/generate/stream.ts` (Node.js runtime,
  uses `@google/generative-ai` SDK, emits NDJSON tokens, handles
  errors mid-stream).
- **T9**: Client streaming parser — `TextDecoder` + buffer, handle
  malformed lines gracefully, AbortController cancellation, preserve
  partial output on disconnect.
- **T10**: Prompt builder — full outline + project metadata (kind,
  language, hypotheses, writingStyle) + content + linked sources.
- **T11**: "Use as Base" button — `setContent(aiDraft)`, debounced save.
- **T12**: Word count via `Intl.Segmenter` (multilingual) with fallback.
- **T13**: Auto-resume last section: store
  `settings.writing_lastSectionId_<projectId>`.
- **T14**: Markdown editor MVP (plain `<textarea>` first cut; Phase O
  follow-up upgrades to TipTap/Lexical).
- **T15**: Tests — Vitest unit tests on prompt builder, NDJSON parser
  (with malformed lines, empty lines, partial buffers); Playwright e2e
  for "open section → generate draft → cancel mid-stream → re-generate
  → use as base → status changes to draft".

## Acceptance criteria

- A user with an active project can navigate to `/writing/section/2.1`,
  see their content, and edit with auto-save.
- "Generate Draft" streams tokens visibly within 1 second of click;
  full draft completes in < 30 seconds for a typical section.
- Cancelling mid-stream stops the call; partial output is preserved on
  screen.
- Network drop preserves partial output and shows soft warning toast.
- Re-clicking "Generate Draft" cancels prior stream cleanly (no
  double-streams).
- "Use as Base" replaces content with the most recent `aiDraft`.
- The draft prompt embeds: project kind, language, writingStyle,
  outline numbers + titles, current section's existing content,
  linked sources (if any), hypotheses (if any).
- No-project mode: `/writing` redirects to a Create-Project CTA.
- Tests pass; ≥ 90 % coverage on `parseNDJsonStream` helper.

## Effort estimate

- T-shirt: **L**
- Person-weeks: **4–5** (Markdown editor follow-up adds another 1-2
  weeks)

## Risks & unknowns

- **Streaming on Edge runtime** — Gemini SDK doesn't fully support
  Vercel Edge as of writing. Phase O sticks with Node.js runtime;
  revisit Edge once SDK is updated.
- **iOS Safari `fetch` streaming** — newer Safari supports
  ReadableStream in fetch responses; older may not. Detect and fall back
  to non-streaming `/api/generate` if needed.
- **Word count for multilingual content** — `Intl.Segmenter` is broadly
  supported but not in older browsers; whitespace fallback acceptable.
- **AI draft quality** — Gemini can produce generic draft output. The
  prompt is the lever; iterate on prompt template based on user
  feedback. Settings expose `prompt_writingDraft` override.

## Out of scope

- Writing exercises — Phase P (the launcher button is wired but the
  ExerciseView component lives in Phase P)
- Markdown editor with `/cite` slash command — Phase O follow-up + Phase Q
- Citation Picker integration — Phase Q
- Draft history / versioning — Phase O follow-up
- Diff merge for AI drafts — Phase O follow-up

## Decision points (revisit before Phase P)

- ✅ NDJSON over SSE — confirmed; see [`33-streaming-ai-and-ndjson.md`](../33-streaming-ai-and-ndjson.md).
- ⚠ Plain textarea vs TipTap — Phase O ships textarea; follow-up
  upgrades. The user can opt in to a "Beta editor" toggle in Settings
  early.
- ⚠ Where does `prompt_writingDraft` live in Settings UI? Decision:
  under the existing "Custom Prompts" panel, with the other prompt
  overrides.

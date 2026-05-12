# Sprint Y: Unlimited Edition — wishlist (pick-and-choose)

> One task per T-item in `docs/implementation-plan/phase-y-unlimited.md` (R1–R23 in source doc).
> If money and developer time were no object. **Phase Y is NOT a single-shot engage sprint** — it's a wishlist. Each task can be split into its own micro-sprint.

> **Operating mode for Sprint Y:** Each of TY.1–TY.23 is intended to be a standalone backlog of its own. Engage one at a time; the broad gate at the bottom of this file applies per-task before the next is picked up.

### Phase 1: Native + browser

### TY.1 -- Native apps via Capacitor | Cx: 21 | P2

**Description:** Wrap PWA with Capacitor. iOS + Android stores. Native push, native share, iOS in-app purchase.

**AC:**
- [ ] App Store + Play Store builds
- [ ] Native push works
- [ ] Native share intent works
- [ ] CI builds + uploads to TestFlight / Internal Testing

**Depends on:** TG.12

### TY.2 -- Browser extension ("Save to Headway") | Cx: 13 | P2

**Description:** Chrome / Firefox extension. Right-click → save URL as Source. Includes selected text as note.

**AC:**
- [ ] Both browsers + edge stores
- [ ] Auth shared with web app
- [ ] Mobile Firefox tested

**Depends on:** TM.19

### Phase 2: Polish + accessibility + design

### TY.3 -- Internationalization | Cx: 13 | P1

**Description:** i18n via Vue/React/Svelte equivalent. At least English + Slovenian (project owner's language) + Spanish.

**AC:**
- [ ] All UI strings extracted
- [ ] 3+ locales bundled
- [ ] Language switcher in settings
- [ ] RTL stubs for future Arabic / Hebrew

**Depends on:** TG.2

### TY.4 -- Full accessibility audit | Cx: 13 | P1

**Description:** WCAG 2.1 AA audit + remediation. Keyboard nav, screen reader, focus management, contrast.

**AC:**
- [ ] axe-core CI gate green
- [ ] Manual screen reader test on macOS + iOS
- [ ] Keyboard-only navigation possible
- [ ] Color contrast ≥ 4.5:1 everywhere

**Depends on:** TG.10

### TY.5 -- Real design system | Cx: 21 | P2

**Description:** Tokenized design system. Storybook for components. Refactor existing UI.

**AC:**
- [ ] Design tokens published
- [ ] Storybook deployed (Chromatic / Vercel)
- [ ] All UI components migrated
- [ ] No regressions

**Depends on:** TG.2

### Phase 3: Multi-user + collab

### TY.6 -- Multi-user / family library | Cx: 21 | P3

**Description:** Multiple profiles per device. Shared family library. Per-user permissions.

**AC:**
- [ ] Profile switching < 1s
- [ ] Per-user progress isolated
- [ ] Shared library opt-in per source

**Depends on:** TU.5

### TY.7 -- Real-time collaboration | Cx: 21 | P3

**Description:** Live cursors + shared selections on chapters / writing sections. Built on Yjs (sprint U).

**AC:**
- [ ] Two-user concurrent editing
- [ ] Latency < 200ms on local
- [ ] Conflict-free per Yjs

**Depends on:** TU.5

### Phase 4: Audio / video / annotation niceties

### TY.8 -- Audiobook narration with character voices | Cx: 21 | P3

**Description:** AI detects dialog vs narration; assigns different voices per character.

**AC:**
- [ ] Dialog detection ≥ 80% accuracy
- [ ] Voice assignment editable
- [ ] Quality A/B vs single-voice acceptable

**Depends on:** TV.3

### TY.9 -- Self-hosted video | Cx: 13 | P3

**Description:** Alternative to Vadoo: self-hosted Stable Video / Animatediff pipeline.

**AC:**
- [ ] Output comparable quality
- [ ] Local-first option works on capable hardware
- [ ] Documented hardware requirements

**Depends on:** TR.1

### TY.10 -- Vector annotations on PDFs | Cx: 13 | P2

**Description:** Replace sprint N raster annotations with vector. SVG overlay; export preserves vectors.

**AC:**
- [ ] Vector strokes scale cleanly
- [ ] Export via jsPDF preserves vector
- [ ] Backward compat with sprint N raster

**Depends on:** TN.13

### Phase 5: Publishing + community

### TY.11 -- Public sharing / publishing | Cx: 13 | P3

**Description:** Publish a section / source / project to a public URL.

**AC:**
- [ ] Public URL stable
- [ ] Privacy controls (private / unlisted / public)
- [ ] Analytics opt-in

**Depends on:** TX.10

### TY.12 -- Marketplace / community library | Cx: 21 | P3

**Description:** Browse public libraries. Fork. Comments.

**AC:**
- [ ] Browse + search + fork
- [ ] Comments moderated
- [ ] Privacy preserved

**Depends on:** TY.11

### TY.13 -- Cohort study features | Cx: 8 | P3

**Description:** Group reading: shared progress, group quizzes, leaderboard.

**AC:**
- [ ] Cohort creation
- [ ] Shared progress dashboard
- [ ] Per-cohort leaderboard

**Depends on:** TY.6

### Phase 6: Premium AI + local LLM

### TY.14 -- Premium AI providers | Cx: 8 | P2

**Description:** Add Anthropic, OpenAI, Mistral, Cohere as first-class providers.

**AC:**
- [ ] All 4 providers implement `CallAIPlugin`
- [ ] Auth flows per provider
- [ ] Cost tracking per provider

**Depends on:** TK.1

### TY.15 -- Local LLM via WebLLM / WebGPU | Cx: 21 | P3

**Description:** Run a small LLM (Phi-3, Llama-3 8B) locally via WebGPU.

**AC:**
- [ ] At least 1 model runs on M-series Macs
- [ ] Quality acceptable for summaries / flashcards
- [ ] Memory profile documented

**Depends on:** TG.7

### Phase 7: Content discovery + journaling

### TY.16 -- Periodic content discovery | Cx: 5 | P3

**Description:** Subscribed feeds (RSS, paper alerts) drop new candidates into Discovery.

**AC:**
- [ ] At least RSS supported
- [ ] Per-feed enable
- [ ] Daily digest integration

**Depends on:** TX.5

### TY.17 -- Speech-to-text journaling | Cx: 8 | P3

**Description:** Voice → note in writing hub. Uses Whisper (sprint V).

**AC:**
- [ ] Real-time transcription
- [ ] Punctuation reasonable
- [ ] Edits preserved

**Depends on:** TV.1

### Phase 8: Character chat + print + smart home

### TY.18 -- Character chat | Cx: 8 | P3

**Description:** Chat with a fictional character from the book.

**AC:**
- [ ] Character voice stays in-prompt
- [ ] Conversation persists per character
- [ ] Avatar generation via image provider

**Depends on:** TC.4

### TY.19 -- Print-to-Headway | Cx: 8 | P3

**Description:** Email-to-import bridge: send PDF/article to a user's unique email → appears as Source.

**AC:**
- [ ] Unique email per user
- [ ] Attachment + body imported
- [ ] Spam protection

**Depends on:** TM.14

### TY.20 -- Smart home / voice integrations | Cx: 13 | P3

**Description:** Alexa / Google Home skills: "play my book on Headway".

**AC:**
- [ ] Both platforms have published skills
- [ ] Voice authentication works
- [ ] Resume position preserved

**Depends on:** TE.8

### Phase 9: Analytics + sharing

### TY.21 -- Analytics dashboard | Cx: 8 | P3

**Description:** Personal analytics: hours read, books finished, top concepts, streak history.

**AC:**
- [ ] All 4 metrics rendered
- [ ] Export as PDF / image
- [ ] Privacy: all device-local

**Depends on:** TT.8

### TY.22 -- Gift / share entire library | Cx: 8 | P3

**Description:** Bundle library + progress + annotations into a transferable package.

**AC:**
- [ ] Recipient imports cleanly
- [ ] Reuses sprint M `chapterwise-import.json` format
- [ ] Optional encryption

**Depends on:** TM.14, TU.4

### TY.23 -- A/B test prompts publicly | Cx: 5 | P3

**Description:** Power-user feature: submit a prompt, compare against community variants.

**AC:**
- [ ] Submission form
- [ ] Community voting
- [ ] Privacy preserved

**Depends on:** TY.11

---

## Sprint enforcement gates (applies per-task, not as a single batch)

For every Sprint-Y task you pick up:

- [ ] **G-AC** — task AC ticked
- [ ] **G-Tests** — feature unit + (where applicable) e2e
- [ ] **G-Manual** — Real-device test where the task touches OS integration
- [ ] **G-Security** — public-facing features security-reviewed
- [ ] **G-State** — `state.md` updated

**No final gate**: Sprint Y is open-ended. Mark tasks done as they ship; never close the sprint.

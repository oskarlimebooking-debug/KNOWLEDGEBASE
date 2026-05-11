# Phase R — Unlimited Edition

> **Tagline:** If money and developer time were no object.

## Goal

The features that don't pay back rationally on a budget but *would*
ship if you had unlimited resources. Native apps, browser extensions,
collaboration, design system, internationalization, accessibility,
audiobook narration with character voices, multi-user libraries.

This phase is the **wishlist**. Pick and choose; don't commit to all
of it.

## Why this phase / rationale

By Phase Q, the app is best-in-class for a single power-user. The
remaining gaps are about reaching new audiences, raising the
production-value ceiling, and doing the things that aren't worth doing
on a small budget but are worth doing if you can afford to.

Each section below is its own multi-month project with its own ROI
analysis. Sequencing depends on which audience you're trying to
serve.

## Prerequisites

- Phases A–Q.
- A real budget.
- A real team (designer, mobile dev, accessibility specialist,
  localization team).

## Deliverables (mix and match)

### R1 — Native apps via Capacitor

Wrap the PWA in a Capacitor shell:
- iOS / Android packages with native StoreKit + Google Play Billing
  for paid features.
- Native push notifications (no web push limitation on iOS).
- Native file access, share sheets.
- Native audio (background continuation regardless of browser tab).
- Faster cold starts via native bundle.

Effort: 6–10 person-weeks for parity + native polish.

### R2 — Browser extension ("Save to Headway")

Chrome / Firefox / Safari extension:
- Right-click a page → "Save to Headway" → fetch via Readability →
  imports as a one-chapter book.
- Highlight selection on any page → "Save quote" → imports as an
  annotation.
- Reading time tracker → counts time on article + roll into streak.

Effort: 3–4 person-weeks per browser.

### R3 — Internationalization

UI in 10+ languages.

- Extract all UI strings to `src/i18n/<lang>.json`.
- Use `formatjs` / `i18next` for runtime selection.
- Locale-aware date formatting, plurals.
- Right-to-left support (Arabic, Hebrew).

Effort: 4 person-weeks for infra + ongoing translation cost.

### R4 — Full accessibility audit

- Keyboard navigation through every flow (Tab, Enter, Escape).
- Screen reader testing (NVDA + JAWS + VoiceOver).
- ARIA labels on every interactive control.
- High-contrast theme (4.5:1 minimum).
- Reduced motion mode.
- Dyslexic-friendly font (already in Phase N as an option;
  productize here).
- WCAG 2.1 AA compliance.

Effort: 4–6 person-weeks + ongoing.

### R5 — Real design system

Hire a designer. Output:
- Token-based (color, spacing, typography, shadow).
- Component library with documented variants.
- Marketing site / landing page.
- App-store screenshots / mockups.
- Onboarding flow with empathy.
- Iconography pass.

Effort: 8–12 person-weeks for designer + dev integration.

### R6 — Multi-user / family library

Shared libraries:
- A "household library" where multiple users see the same books.
- Per-user progress / streaks / annotations.
- Per-user feed personalities.
- Permissions: who can add books, who can edit.

Implementation: layer on top of the Phase O CRDT sync — each user
has their own per-chapter Y.Doc; book metadata is shared.

Effort: 6–10 person-weeks.

### R7 — Real-time collaboration

Live presence: see your study partner's cursor + selection in the
chapter. Co-watch a chapter video. Collaborative annotations.

Built on Phase O's WebSocket hub.

Effort: 6–10 person-weeks.

### R8 — Audiobook narration with character voices

Each detected dialogue gets a different voice. Each character voice
is consistent across chapters. Optional music / SFX cues.

Use multi-speaker TTS like Tortoise / XTTS-v2:
- Detect speakers via the AI.
- Assign one voice per speaker (auto-pick from a pool, or user-edit).
- Render with character voices.

Effort: 8–12 person-weeks. Quality bar is the bottleneck.

### R9 — Self-hosted video

Replace Vadoo:
- FFmpeg.wasm in a worker.
- AI-generated background visuals (Replicate / Stable Diffusion).
- Local TTS audio (Phase P).
- Caption overlay (Phase P timestamps).
- Per-second image cuts driven by the script.

Effort: 8–12 person-weeks.

### R10 — Vector annotations on PDFs

Replace the raster "save with highlights" (Phase J) with proper
vector PDF editing:
- Use PDF.js's `getOperatorList` to read the original content stream.
- Inject highlights / pen strokes as annotations into the
  ContentStream.
- Output retains text searchability and original quality.

Effort: 6–8 person-weeks. Highly specialized.

### R11 — Public sharing / publishing

Generate a shareable URL for a book / chapter / annotation:
- Server-side rendering of a beautiful read-only view.
- "Sign up to import this into your own Headway".
- Privacy controls (public / unlisted / private with passphrase).

Effort: 6–10 person-weeks. Requires real backend.

### R12 — Marketplace / community library

A public catalog where users can share imported / annotated books
(within copyright).

- Curated reading lists.
- Annotation overlays from notable annotators.
- Custom personality packs (Phase Q).

Effort: 12–20 person-weeks. Major operational lift.

### R13 — Cohort study features

Two friends both reading the same book:
- Compare progress.
- Compare quiz scores.
- Compare annotations side by side.
- Async voice notes.

Effort: 8–12 person-weeks.

### R14 — Premium AI providers

- Anthropic Claude direct (via user's own key).
- OpenAI GPT-5 / o3 direct.
- Together / Groq / Mistral / DeepSeek.
- Optional: a "subscription" that bundles credits with the app
  (requires payment infrastructure and is a different product).

Effort: 1 person-week per provider.

### R15 — Local LLM via WebLLM / WebGPU

Bundle a small LLM (Llama 3 8B Q4 or similar) for fully-local
generation:
- Summary, flashcards, basic quiz can all run on-device.
- Slow (~10 tok/s on a high-end device) but private.
- Network optional.

Effort: 4–6 person-weeks.

### R16 — Periodic content discovery

For non-fiction:
- New papers in your fields of interest auto-imported daily from
  Arxiv / Semantic Scholar / etc.
- "Reading list digest" email or push notification with curated picks.

Effort: 4–8 person-weeks (also needs a backend).

### R17 — Speech-to-text journaling

Record voice notes about a chapter → Whisper transcribes → AI
extracts key insights → adds to the chapter's annotations.

Effort: 2–4 person-weeks (Phase P provides Whisper).

### R18 — Character chat

Talk to the **author** of the book (or to a character):
- AI roleplay with the book's content as ground truth.
- "What would Kahneman say about Thinking Fast and Slow chapter 5?"

Effort: 2–4 person-weeks. Mostly prompt engineering.

### R19 — Print-to-Headway

OCR a stack of pages via the camera (PWA `getUserMedia`):
- Capture each page.
- Run AI-OCR.
- Build a book on the fly.

Effort: 4–6 person-weeks.

### R20 — Smart home / voice integrations

- Alexa / Google Assistant skill: "Hey Google, read me the next
  chapter of Sapiens."
- Siri Shortcuts.
- Apple Watch playback control.

Effort: 2–4 person-weeks per platform.

### R21 — Analytics dashboard

Personal reading analytics:
- Hours read this year.
- Books finished by month.
- Genre distribution.
- Difficulty trend.
- Quiz performance over time.
- "You read 30% more in October than September."

Effort: 2–4 person-weeks (data is already there from progress
tracking).

### R22 — Gift / share entire library

A full library export package as a single encrypted file → share with
a friend who imports it (subject to copyright).

Effort: 1 person-week (already built — Phase I — just needs polish).

### R23 — A/B test prompts publicly

Power users can publish their custom prompts to a community library.
Other users browse and install.

Effort: 4–8 person-weeks.

## Acceptance criteria

There is no single acceptance criterion for this phase; each item has
its own. Pick what to ship and define DoD per feature.

## Effort estimate

- **T-shirt:** XXL
- **Person-weeks:** 12–100+ depending on selection.

## Risks & unknowns

- **Scope inflation** is the dominant risk. Treat each Phase R item
  as an independent project with its own ROI assessment.
- **Backend creep** — many Phase R items want a real server. Doing
  one breaks the "no backend" story; doing several is justified.
  Decide consciously.
- **Operational cost** — collaboration / public sharing / community
  features have real ongoing costs.
- **Audience risk** — the wishlist is broad; not all of it serves
  the same user. Pick the audience first.

## Out of scope

By definition, Phase R is the catch-all. There's no "out of scope".

## Decision points

For each Phase R candidate ask:
- [ ] Who specifically benefits?
- [ ] How many of those users do we currently have?
- [ ] What's the marginal cost (engineering + ongoing)?
- [ ] Could we ship a tiny version to validate first?
- [ ] Is this 80/20 or 95/5?

---

End of implementation plan. Back to [`00-overview.md`](00-overview.md).

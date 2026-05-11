# Sprint R: Video & Image Plus — Vadoo TikTok-style + Bonkers (via Merlin)

> One task per T-item in `docs/implementation-plan/phase-r-video-and-images.md` (K1–K11 in source doc).
> Vadoo AI for vertical short-form videos per chapter or book. Bonkers (via Merlin) as second image provider for feed + AI cover regen.

### Phase 1: Vadoo client + scripts

### TR.1 -- Vadoo client | Cx: 8 | P0

**Description:** API client. Uses `/api/vadoo/proxy` (sprint K). Endpoints: generate video, poll status.

**AC:**
- [ ] Client deploys + authenticates
- [ ] Vitest mocks the API
- [ ] Failure surfaces actionable error
- [ ] Cost estimate displayed pre-generation

**Depends on:** TK.10

### TR.2 -- Viral script personas | Cx: 5 | P1

**Description:** Hook/build/payoff structure templates. 3-4 personas (educator, hype, narrator, expert).

**AC:**
- [ ] Templates documented
- [ ] User can pick persona per chapter
- [ ] Snapshot tests on script output

**Depends on:** TR.1

### TR.3 -- Script generation | Cx: 8 | P0

**Description:** AI generates 60s script from chapter + persona. Returns JSON with `hook`, `build`, `payoff`, `captions`.

**AC:**
- [ ] Script length ≈ 60s when narrated
- [ ] Captions match script
- [ ] JSON validates via zod

**Depends on:** TR.2, TB.1

### TR.4 -- Polling | Cx: 5 | P1

**Description:** Poll Vadoo status until video URL ready. Exponential backoff.

**AC:**
- [ ] Backoff caps at 30s
- [ ] Status visible in UI
- [ ] Cancellable

**Depends on:** TR.1

### Phase 2: UI integration

### TR.5 -- Video tab UI | Cx: 8 | P1

**Description:** Tab in chapter view. Shows generated video, captions overlay, download.

**AC:**
- [ ] Video plays inline
- [ ] Download produces MP4
- [ ] Generated video cached by chapterId
- [ ] Empty state with "Generate"

**Depends on:** TR.3, TR.4

### TR.6 -- Book Video modal | Cx: 8 | P2

**Description:** Generate book-level video (summary of all chapters).

**AC:**
- [ ] Modal opens from book detail
- [ ] Chapter selector (include/exclude)
- [ ] Output single MP4

**Depends on:** TR.5

### TR.7 -- Vadoo settings | Cx: 3 | P1

**Description:** API key, default voice, default persona, video length preference.

**AC:**
- [ ] All settings persist
- [ ] Validation on API key
- [ ] Test-connection works

**Depends on:** TA.8

### Phase 3: Bonkers image provider

### TR.8 -- Bonkers provider (via Merlin) | Cx: 8 | P1

**Description:** Image generation through Merlin's Bonkers integration. New `ImagePlugin` (sprint G).

**AC:**
- [ ] Returns base64 JPEG
- [ ] Falls back to Gemini if Bonkers unavailable
- [ ] Vitest with mocked Merlin

**Depends on:** TK.3, TG.6

### TR.9 -- Image provider switch | Cx: 3 | P1

**Description:** Settings: default image provider. Feed (sprint D) and AI cover use switched provider.

**AC:**
- [ ] Switch takes effect on next generation
- [ ] Per-feature override possible
- [ ] Migration: existing settings preserved

**Depends on:** TR.8, TD.5

### TR.10 -- AI cover regeneration | Cx: 5 | P2

**Description:** "Regenerate Cover" action on book detail. Uses image provider.

**AC:**
- [ ] Generates cover from title + author
- [ ] Replaces existing cover (with confirm)
- [ ] Failure leaves cover unchanged

**Depends on:** TR.9

### TR.11 -- Sync extension | Cx: 3 | P1

**Description:** Add video cache + Vadoo settings to Drive envelope.

**AC:**
- [ ] Video cache (per-chapter URLs) syncs
- [ ] Vadoo settings sync via whitelist
- [ ] Backward compat handled

**Depends on:** TF.7

---

## Sprint enforcement gates (must pass before Sprint S begins)

- [ ] **G-AC** — all task AC ticked
- [ ] **G-Manual** — Real-device video playback on iOS + Android
- [ ] **G-Security** — Vadoo proxy doesn't persist keys
- [ ] **G-State** — `state.md` updated

**Decision points before Sprint S:**

- [ ] Bonkers as default image provider? (Currently keep Gemini)
- [ ] Video caching strategy (URLs vs binary)

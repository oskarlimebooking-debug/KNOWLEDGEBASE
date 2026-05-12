# Sprint H: Multi-Project Workspaces — Project entity + JSON import + switcher

> One task per T-item in `docs/implementation-plan/phase-h-multi-project-workspaces.md`.
> Adds the `Project` entity so the user can create, switch, and import multiple research/writing projects.
> No-project mode preserves backward compatibility for the existing reading flows.

### Phase 1: Data model + nav

### TH.1 -- Project + ProjectSection interfaces (Dexie v2→v3) | Cx: 8 | P0

**Description:** Define `Project` and `ProjectSection` in `src/data/stores/projects.ts` and `projectSections.ts`. Add Dexie migration v2→v3 creating both stores.

**AC:**
- [ ] zod schemas + TS types for both
- [ ] Dexie migration adds stores cleanly on existing v2 DB
- [ ] Existing user without projects still boots normally
- [ ] Vitest: schema + migration with 50-source fixture

**Depends on:** TG.4

### TH.2 -- ProjectSwitcher (top nav) | Cx: 8 | P0

**Description:** Top-bar `ProjectSwitcher` dropdown listing all projects + actions ("New project", "Import from JSON", "Manage…").

**AC:**
- [ ] Switcher dropdown lists projects + actions
- [ ] Keyboard navigable
- [ ] Empty state shows "No projects yet — create one"
- [ ] Mobile: switcher fits in viewport

**Depends on:** TH.1

### TH.3 -- Side-nav: Discovery + Writing | Cx: 3 | P1

**Description:** Side-nav additions for Discovery and Writing (hidden in no-project mode).

**AC:**
- [ ] Writing hidden when `activeProjectId` is null
- [ ] Discovery always visible (uses global keyword fallback)
- [ ] Navigation focus/keyboard accessible

**Depends on:** TH.2

### TH.4 -- useProjectStore (Zustand) | Cx: 5 | P0

**Description:** Zustand store with `activeProjectId` and derived `activeProject`. Persist `activeProjectId` to settings via Dexie LiveQuery sync.

**AC:**
- [ ] Store reactive across components
- [ ] `activeProjectId` persists across reload
- [ ] LiveQuery updates the store automatically on Dexie writes
- [ ] Vitest: store transitions + persistence

**Depends on:** TH.1

### Phase 2: Create + import + hub

### TH.5 -- Create-project modal (4 presets) | Cx: 8 | P1

**Description:** Modal with 4 preset templates (Empty thesis, Empty article, Empty book outline, Blank). Each preset generates seed `ProjectSection` rows.

**AC:**
- [ ] All 4 presets create matching seed outlines
- [ ] Validation on title (required, ≤ 200 chars)
- [ ] Cancel returns to previous view without side effects
- [ ] Vitest snapshots seed outlines

**Depends on:** TH.4

### TH.6 -- JSON project import | Cx: 13 | P0

**Description:** Extend `importFromPackage` to accept `chapterwise-import.json` envelope with `type: "project"` shortcut OR `projects` + `project_sections` arrays. Idempotent upsert by ID.

**AC:**
- [ ] Both envelope shapes import cleanly
- [ ] Idempotent: re-import asks "Overwrite or create new?"
- [ ] zod-validated input rejects malformed envelopes with clear errors
- [ ] Vitest fixtures: thesis JSON, article JSON, blank JSON

**Depends on:** TH.5

### TH.7 -- Auto-import banner | Cx: 3 | P2

**Description:** Extend `checkForLocalImport` detection to count projects + sections.

**AC:**
- [ ] Banner shows on detection
- [ ] Counts accurate for projects + sections
- [ ] Dismiss persists per-import-file

**Depends on:** TH.6

### TH.8 -- Project Hub view (MVP) | Cx: 5 | P1

**Description:** Minimal: title, kind, dates, totals, buttons (Edit metadata, Export, Archive, Delete).

**AC:**
- [ ] All metadata renders
- [ ] Buttons wired to TH.9 + TH.10
- [ ] Last-edited list shows up to 5 sections
- [ ] Empty state when no sections yet

**Depends on:** TH.5

### TH.9 -- Edit-project metadata modal | Cx: 5 | P1

**Description:** Edit title, kind, language, hypotheses, keywords, writingStyle, totalWordTarget.

**AC:**
- [ ] All 7 fields editable + persisted
- [ ] Hypotheses + keywords are arrays (add/remove rows)
- [ ] Validation on totalWordTarget (positive integer)
- [ ] Save shows confirmation toast

**Depends on:** TH.8

### TH.10 -- Archive / unarchive / delete project | Cx: 5 | P1

**Description:** Archive toggle; delete with confirmation + cascade delete of sections + citations. **Cascade does NOT delete library Sources.**

**AC:**
- [ ] Archive hides from default switcher list (show in "Manage…")
- [ ] Delete cascade verified: sections + citations gone; sources kept
- [ ] Confirmation modal blocks accidents
- [ ] Vitest: cascade delete invariants

**Depends on:** TH.8

### Phase 3: Sync + migration + tests

### TH.11 -- Drive sync envelope extension | Cx: 5 | P0

**Description:** Add `projects` and `project_sections` to upload, download, merge in the F-era sync.

**AC:**
- [ ] Envelope round-trip preserves both stores
- [ ] mergeArrayById handles project conflicts via `updatedAt` field
- [ ] Backward compat: pre-H envelopes still load cleanly (empty projects)
- [ ] Test with two-device fixture

**Depends on:** TF.7, TH.1

### TH.12 -- Migration: legacy users see new nav | Cx: 3 | P1

**Description:** Existing users see the new nav with no projects yet; their library and reading flows are unchanged.

**AC:**
- [ ] Reading flow untouched (Playwright e2e)
- [ ] No "configure projects" nag screen
- [ ] Switcher empty state is welcoming

**Depends on:** TH.2

### TH.13 -- Tests (unit + e2e) | Cx: 8 | P0

**Description:** Vitest on `Project` validators, project JSON import, section path-IDs validity. Playwright e2e: create project → switch active → write in section → switch back → see saved content.

**AC:**
- [ ] zod validator coverage ≥ 90%
- [ ] e2e green on CI
- [ ] Edge cases (project ID collision, malformed sections) covered

**Depends on:** TH.11

---

## Sprint enforcement gates (must pass before Sprint I begins)

- [ ] **G-AC** — all task AC ticked
- [ ] **G-Migrate** — v2 → v3 migration zero-loss
- [ ] **G-Tests** — coverage ≥ 86%; JSON validators ≥ 90%
- [ ] **G-Manual** — No-project mode UX validated (Discovery visible with global keyword fallback; Writing hidden)
- [ ] **G-State** — `state.md` updated

**Decision points before Sprint I:**

- [ ] Confirm JSON import format final (`22-import-file-format.md`)
- [ ] Is project archiving sufficient or do we need "soft delete" with recovery period?
- [ ] Should switcher show recent vs alphabetical first?

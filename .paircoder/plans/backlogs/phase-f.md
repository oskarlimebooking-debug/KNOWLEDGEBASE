# Sprint F: Cloud Sync via Google Drive — Streaming, Merge, Token Refresh

> One task per T-item in `docs/implementation-plan/phase-f-cloud-sync.md`.
> Multi-device library through user's own Drive `appDataFolder`. No backend service.
> The streaming-upload pattern is THE hard problem here — naive `JSON.stringify` OOMs on iOS for large libraries.

### Phase 1: OAuth + sync file

### TF.1 -- OAuth via Google Identity Services | Cx: 13 | P0

**Description:** Inject `https://accounts.google.com/gsi/client`. `google.accounts.oauth2.initTokenClient` with scope `drive.appdata`. `handleTokenResponse`: store `googleAccessToken` + `googleTokenExpiry` in settings; find-or-create sync file. `disconnectGoogleDrive`: POST `https://oauth2.googleapis.com/revoke?token=...`; clear token + expiry.

**AC:**
- [ ] User can connect Drive on Chrome desktop, iOS Safari, Android Chrome
- [ ] Token + expiry persist in IDB (not localStorage)
- [ ] Disconnect successfully revokes (verify in Google account permissions page)
- [ ] OAuth client_id documented as self-hoster's responsibility in README

**Depends on:** TA.2, TA.8

### TF.2 -- Find or create sync file | Cx: 5 | P0

**Description:** `GET /drive/v3/files?spaces=appDataFolder&q=name='chapterwise-sync.json'`. If found, store id; else multipart upload `{ metadata: {name, parents: ['appDataFolder']}, file: '{}' }`.

**AC:**
- [ ] First-time user: file is created with `{}` body
- [ ] Returning user: existing file id is reused
- [ ] Idempotent: running twice doesn't create duplicates
- [ ] Network error surfaces gracefully

**Depends on:** TF.1

### Phase 2: Snapshot shape + upload/download

### TF.3 -- Sync data shape + settings whitelist | Cx: 5 | P0

**Description:** Shape: `{ version: 1, syncedAt, books: [...], chapters: [...], progress: [...], generated: [...], settings: {...} }`. Books include PDFs as base64 with `_pdfDataIsBase64`. Settings whitelist documented and enforced (apiKey, model, image config, TTS keys, AI provider tokens, `prompt_*` custom prompts, etc.).

**AC:**
- [ ] Whitelist exhaustive (covers every provider added so far)
- [ ] zod schema validates the envelope
- [ ] No non-whitelisted setting leaks into upload
- [ ] Vitest fuzzes the schema

**Depends on:** TA.2

### TF.4 -- getSyncDataForUpload(excludePdfData) | Cx: 8 | P0

**Description:** Build snapshot. If `excludePdfData`, set `_pdfDataExcluded: true` and drop `pdfData`. Otherwise inflate `pdfData: ArrayBuffer` to base64 with `_pdfDataIsBase64: true`. `arrayBufferToBase64` chunks at 8 KB to avoid quadratic string concat on iOS.

**AC:**
- [ ] Both modes (with/without pdfData) produce valid envelope
- [ ] Base64 conversion of 50MB ArrayBuffer doesn't OOM on iOS proxy
- [ ] Round-trip: encode → decode produces identical ArrayBuffer
- [ ] Vitest covers 10kb / 1mb / 50mb fixtures

**Depends on:** TF.3

### TF.5 -- uploadToCloud (full overwrite) | Cx: 5 | P1

**Description:** `PATCH /upload/drive/v3/files/<id>?uploadType=media` with full JSON body. 120s AbortController timeout. Confirm with user.

**AC:**
- [ ] Upload succeeds for a 10MB library
- [ ] Confirm dialog blocks accidental overwrite
- [ ] Timeout aborts cleanly and notifies user
- [ ] Status pill shows "Uploading…" during operation

**Depends on:** TF.4

### TF.6 -- downloadFromCloud | Cx: 8 | P1

**Description:** `GET /drive/v3/files/<id>?alt=media`. 60s timeout. Parse, inflate base64 → ArrayBuffer for each book. Write to IDB (overwrite local). Confirm before destroying local data.

**AC:**
- [ ] Download → IDB restore works on fresh device
- [ ] Confirm dialog blocks accidental destruction
- [ ] Inflation matches encoded checksum
- [ ] Failure rolls back IDB (no partial state)

**Depends on:** TF.4

### Phase 3: Streaming merge (THE hard one)

### TF.7 -- syncNow streaming merge | Cx: 21 | P0

**Description:** 6-stage flow: (1) Download cloud (60s; 401 → disconnect + reconnect prompt). (2) `localData = getSyncDataForUpload(excludePdfData=true)`. (3) `merged = mergeData(localData, cloudData)` (last-write-wins on date fields; local wins for settings). (4) `importSyncDataIncremental(merged)` (writes books/chapters/progress/generated/settings; for books with `_pdfDataExcluded`, keep existing local pdfData). (5) Stream-build upload Blob using `parts[]` array of strings — DO NOT `JSON.stringify` the whole envelope (OOMs on iOS). (6) `PATCH` Blob with 120s timeout.

**AC:**
- [ ] Memory profile during 100MB sync stays under 200MB peak on desktop (proxy for iOS)
- [ ] Stage 5 streaming-build works (Vitest snapshot the parts array shape)
- [ ] Two devices editing same chapter → more recent edit wins post-merge
- [ ] `_pdfDataExcluded` round-trip: PDFs stay local after sync
- [ ] 401 mid-flight: clean disconnect + reconnect prompt

**Depends on:** TF.6, TF.5, TF.8

### TF.8 -- Merge algorithm (mergeArrayById) | Cx: 8 | P0

**Description:** `mergeData(local, cloud)`: for each store, `mergeArrayById(localArr, cloudArr, dateField?)`. Settings: local takes priority. `mergeArrayById`: Map by id; cloud first, local overwrites if dateField missing or local date ≥ cloud. Date fields: `books.addedAt`, `progress.date`, `generated.generatedAt`; chapters none (latest by import order).

**AC:**
- [ ] Unit tests for all 4 store cases (with/without date field; conflict / no conflict)
- [ ] Settings: local wins (current device priority)
- [ ] Idempotent: merge(a, merge(a, b)) === merge(a, b)
- [ ] No silent data loss in conflict tests

**Depends on:** TF.3

### TF.9 -- Sync UI (pill + buttons + last-sync) | Cx: 5 | P1

**Description:** Status pill (top of settings or floating): Connected (green), Syncing (pulse), Error (red), Disconnected (gray). Three buttons when connected: Sync Now, Upload to Cloud, Download from Cloud. Last-sync timestamp. Disable buttons during sync.

**AC:**
- [ ] All 4 states render distinctly
- [ ] Buttons disable during ops and re-enable on completion
- [ ] Last-sync persists across reload
- [ ] Errors show with one-line summary + "Details" expander

**Depends on:** TF.5, TF.6, TF.7

### TF.10 -- Token refresh (401 handling) | Cx: 3 | P1

**Description:** On mid-flight 401, call `disconnectGoogleDrive()` and prompt re-auth. (Silent refresh deferred; GIS browser-only doesn't support it cleanly. May add `prompt: 'none'` on focus in a later sprint.)

**AC:**
- [ ] 401 produces a friendly "Session expired — reconnect" UX
- [ ] State pill shows Disconnected after 401
- [ ] User can reconnect with one tap

**Depends on:** TF.1

### TF.11 -- iOS Safari Connect button (user-gesture flow) | Cx: 5 | P1

**Description:** GIS popup requires synchronous user gesture. If GIS isn't loaded on first tap: toast "Loading Google services. Tap Connect again in a moment.", inject script, second tap opens popup correctly.

**AC:**
- [ ] First tap on iPad: shows toast, no popup blocker fires
- [ ] Second tap: popup opens correctly
- [ ] Manual test on real iPad Safari (G-Manual gate)

**Depends on:** TF.1

---

## Sprint enforcement gates (must pass before Sprint G begins)

- [ ] **G-AC** — all task AC ticked
- [ ] **G-Manual** — Two-device round-trip: device A edits chapter, syncs; device B syncs, sees edit
- [ ] **G-Migrate** — round-trip preserves the FULL envelope (no field drops)
- [ ] **G-Tests** — memory profile under 200MB peak with 100MB library
- [ ] **G-Security** — OAuth client_id documented; no server-side key storage
- [ ] **G-State** — `state.md` updated

**Decision points before Sprint G:**

- [ ] Decide whether to sync audio via Drive (default yes; large but optional)
- [ ] Decide if "Download from Cloud" stays a confirmation modal (recommended) or becomes destructive button
- [ ] Decide on optional sync-warnings panel for detected conflicts (currently silent merge)

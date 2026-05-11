# Phase F — Cloud Sync via Google Drive

> **Tagline:** Multi-device library, no backend required.

## Goal

Sync the user's library (books, chapters, progress, generated cache,
settings) across devices through their own Google Drive
`appDataFolder`, with no backend service in between.

## Why this phase / rationale

By Phase F, a user has invested significant work into their library
(uploads, edits, generated content). Losing it to a tab close or
device switch is the worst possible experience. Drive sync is also a
prerequisite for any device-switching feature in later phases.

The streaming upload / merge architecture is **the** hard problem in
this phase. iOS Safari kills tabs at ~300–500 MB heap, and a naive
JSON serialization of a library with 100 MB of base64 PDFs blows
through that. The solution is non-obvious; this is why Phase F gets
its own bracket.

## Prerequisites

- Phase A (IDB schema).
- Phase B (settings store).

## Deliverables

- Settings: Connect Google Drive (OAuth via Google Identity Services).
- `chapterwise-sync.json` file in user's Drive `appDataFolder`.
- Three actions: Sync Now, Upload to Cloud, Download from Cloud.
- Memory-safe streaming upload for large libraries.
- Last-write-wins merge by date field.
- Settings whitelist sync (API keys, custom prompts).
- Disconnect (revokes the OAuth token).
- Token refresh on expiry.
- Sync status indicator (connected / syncing / error / disconnected).
- Last-sync timestamp display.

## Task breakdown

### F1 — OAuth via Google Identity Services

```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

```js
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.appdata';

google.accounts.oauth2.initTokenClient({
  client_id: '<CLIENT_ID>',
  scope: GOOGLE_SCOPES,
  callback: handleTokenResponse,
});
```

OAuth client setup steps for self-hosters:
1. Create a Google Cloud project.
2. Enable the Drive API.
3. Add an OAuth 2.0 Web Client.
4. Authorized origins: your Vercel deployment + localhost.
5. Authorized redirects: same.
6. Substitute the client_id in the source.

`handleTokenResponse(response)`:
- Store `googleAccessToken` + `googleTokenExpiry` (Date.now() +
  expires_in * 1000) in settings.
- Update sync UI to "connected".
- Find or create the sync file.

`disconnectGoogleDrive()`:
- POST to `https://oauth2.googleapis.com/revoke?token=<token>`.
- Clear stored token + expiry.
- Update UI.

### F2 — Find or create the sync file

```
GET https://www.googleapis.com/drive/v3/files
   ?spaces=appDataFolder
   &q=name='chapterwise-sync.json'
Authorization: Bearer <token>
```

If the result has `files[0]`, store its `id`. Else create with a
multipart upload:

```
POST /upload/drive/v3/files?uploadType=multipart
multipart body:
  metadata: { name: 'chapterwise-sync.json', parents: ['appDataFolder'] }
  file: '{}'
```

### F3 — Sync data shape

```jsonc
{
  "version": 1,
  "syncedAt": "<ISO>",
  "books": [...],          // PDFs as base64 with _pdfDataIsBase64 flag
  "chapters": [...],
  "progress": [...],
  "generated": [...],      // includes audio cache (optional)
  "settings": { ... }       // whitelisted keys + prompt_*
}
```

Settings whitelist (what to sync):

```
apiKey, selectedModel, imageProvider, imageModel,
useLazybirdTts, lazybirdApiKey, lazybirdVoice,
useGoogleTts, googleTtsApiKey, googleTtsVoice,
aiProvider (Phase H), merlinIdToken, ..., juniaToken, ...,
docanalyzerApiKey, ..., vadooApiKey, vadooVoice, ...,
prompt_* (every custom prompt)
```

### F4 — `getSyncDataForUpload(excludePdfData)`

Build the snapshot. If `excludePdfData` is true (used in `syncNow`'s
merge stage):
- Set `_pdfDataExcluded: true` on each book.
- Drop `pdfData` from the row.

Otherwise inflate `pdfData: ArrayBuffer` to base64 with
`_pdfDataIsBase64: true`.

`arrayBufferToBase64(buffer)` chunks at 8 KB to avoid quadratic string
concat on iOS.

### F5 — Upload (`uploadToCloud`)

Simple full overwrite:

```
PATCH /upload/drive/v3/files/<id>?uploadType=media
Authorization: Bearer <token>
Content-Type: application/json

<JSON.stringify(getSyncDataForUpload())>
```

120s AbortController timeout. Confirm with user before sending.

### F6 — Download (`downloadFromCloud`)

```
GET /drive/v3/files/<id>?alt=media
```

60s timeout. After fetch:
- `JSON.parse(text)`.
- For each book: inflate base64 pdfData → ArrayBuffer.
- Write to IDB (overwriting local).
- Confirm with user before destroying local data.

### F7 — Smart sync (`syncNow`) — the hard one

The full merge sequence:

```
Stage 1: Download cloud (60s timeout). On 401 → disconnect + ask reconnect.
Stage 2: localData = getSyncDataForUpload(excludePdfData = true)
Stage 3: merged = mergeData(localData, cloudData)
         (last-write-wins on date fields, local wins for settings)
Stage 4: importSyncDataIncremental(merged)
         (writes books/chapters/progress/generated/settings to IDB.
          For books with _pdfDataExcluded, keeps existing local pdfData.)
Stage 5: Stream-build the upload Blob:

  parts = ['{"version":1,"syncedAt":"...","books":[']
  for (book of books from IDB):
    book = clone, base64-inflate pdfData
    parts.push(prefix + JSON.stringify(book))
    book = null  // release the JS string
  parts.push('],"chapters":' + JSON.stringify(chapters))
  parts.push(',"progress":' + JSON.stringify(progress))
  parts.push(',"generated":' + JSON.stringify(generated))
  parts.push(',"settings":' + JSON.stringify(settings))
  parts.push('}')
  uploadBlob = new Blob(parts, { type: 'application/json' })

Stage 6: PATCH the Blob with 120s timeout.
```

The streaming pattern is essential. A naive `JSON.stringify(data)`
materializes a 200+ MB string for big libraries and OOMs the iOS tab.

### F8 — Merge algorithm

`mergeData(local, cloud)`:
- For each store, `mergeArrayById(localArr, cloudArr, dateField?)`.
- Settings: local takes priority (current device wins).

`mergeArrayById`:
```js
const map = new Map();
for (const item of cloudArr) map.set(item.id, item);
for (const item of localArr) {
  if (dateField && map.has(item.id)) {
    if (Date(item[dateField]) >= Date(existing[dateField])) {
      map.set(item.id, item);
    }
  } else {
    map.set(item.id, item);
  }
}
return [...map.values()];
```

Date fields used:
- `books`: `addedAt`
- `progress`: `date`
- `generated`: `generatedAt`
- `chapters`: none (latest wins by import order)

### F9 — Sync UI

Status pill (top of settings or floating):
- Connected (green dot).
- Syncing (pulsing).
- Error (red).
- Disconnected (gray).

Three buttons (visible when connected):
- Sync Now.
- Upload to Cloud.
- Download from Cloud.

Last-sync timestamp.

Disable buttons during a sync (via `disableSyncButtons(true)`).

### F10 — Token refresh

If the access token expires mid-flight:
- Catch 401.
- Call `disconnectGoogleDrive()` and prompt re-auth.

(Token refresh isn't supported by GIS for browser-only clients; the
user must re-tap Connect when the token expires after ~1 hour. A
later phase may add `prompt: 'none'` for silent refresh on focus.)

### F11 — iOS Safari nuance for Connect button

Connecting Drive must happen synchronously inside a user gesture
because `requestAccessToken` opens a popup. If GIS isn't loaded yet:

- Show toast: "Loading Google services. Tap Connect again in a moment."
- Inject the GIS script.
- On second tap, GIS is ready and the popup opens correctly.

## Acceptance criteria

- [ ] User can connect Drive and see "Connected".
- [ ] First sync uploads the entire library.
- [ ] Disconnect and reconnect on a different device → library
      restores via Sync Now.
- [ ] `_pdfDataExcluded` round-trips: a sync that excluded PDFs
      doesn't lose them on the receiving device.
- [ ] Memory profile during a 100 MB sync stays under 200 MB peak on
      desktop (acceptable proxy for iOS).
- [ ] Token revocation on disconnect is verified via the Google
      account permissions page.
- [ ] Two devices editing the same chapter → the more recent edit
      wins after both sync.
- [ ] Custom prompts sync correctly (test by changing a prompt on
      device A, syncing, opening device B).

## Effort estimate

- **T-shirt:** M
- **Person-weeks:** 2–3
- **Critical path:** the streaming upload pattern.

## Risks & unknowns

- **OAuth client_id is hard-coded in the source.** A self-hoster has
  to rebuild with their own. Document this clearly.
- **iOS popup-blocker** can break the OAuth flow if the user gesture
  is broken by an `await`. Test the Connect button flow on a real iPad.
- **Drive quota** — appData counts against the user's 15 GB free quota.
  Books + audio can blow through this. Surface storage usage in
  Settings.
- **Concurrent sync** — if two devices sync at the same time, last
  upload wins. CRDTs in Phase O fix this; for now, document the limit.

## Out of scope

- Encryption (Phase O).
- Multi-cloud (Phase O).
- Real-time CRDTs (Phase O).
- Auto-sync on idle (Phase O).
- Per-store delta sync (Phase O).
- Background sync without an open tab (Phase O).

## Decision points before Phase G

- [ ] Confirm whether to sync audio (default yes; large but optional).
- [ ] Decide whether to add a "sync warnings" panel that shows
      detected conflicts even though merge is automatic.
- [ ] Decide if "Download from Cloud" should be a destructive button
      or a confirmation modal (currently confirmation modal).

---

Continue to [Phase G — Advanced Quizzes & Learning Hub](phase-g-advanced-quizzes.md).

# 17 — Google Drive Sync

The user's library + projects can be synced across devices via their own
Google Drive `appDataFolder`. The app stores a single JSON file
`chapterwise-sync.json` in that hidden folder.

Post-merger, the sync envelope includes **all 12 IDB stores** (was 5):

- READ pillar: `sources` (was `books`), `chapters`, `progress`,
  `generated`, `settings`
- WRITE pillar: `projects`, `project_sections`, `writing_exercises`,
  `citations`
- RESEARCH pillar: `discovery_results`, `research_feedback`, optionally
  `discovery_cache`

See [`22-import-file-format.md`](22-import-file-format.md) for the
complete envelope schema and [`32-source-vs-book.md`](32-source-vs-book.md)
for the v1 → v2 migration path.

Phase U (Sync Plus) introduces per-store delta sync, replacing the
single JSON envelope with a folder-of-deltas structure for very large
libraries.

## Why appDataFolder?

- **Privacy**: the app can only see its own files, never the user's other
  Drive content.
- **Quota**: counts against the user's Drive quota, not the app's.
- **Hidden**: the folder isn't shown in the user's normal Drive UI.
- **No server**: no backend means no data custody. The user controls
  their own data.

## OAuth setup

`GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.appdata'`

`currentGoogleClientId = '729588428421-f5kca5hm446cn8c5v0qrnkl3456b6dgi.apps.googleusercontent.com'`

(This is hardcoded in `index.html:23806`. A self-hoster needs to replace
it with their own OAuth client.)

Auth flow uses **Google Identity Services** (GIS, not the deprecated
gapi.auth2):

```
<script src="https://accounts.google.com/gsi/client" async defer>
```

`initGoogleAuth()` initializes a token client, registers the callback,
checks for a stored token, sets the UI state.

`connectGoogleDrive()` triggers `requestAccessToken({ prompt: 'consent' })`.
The token + expiry are stored under `googleAccessToken` and
`googleTokenExpiry` settings keys.

`handleTokenResponse(response)` writes them on success and calls
`findOrCreateSyncFile()`.

`disconnectGoogleDrive()` revokes the token via
`POST https://oauth2.googleapis.com/revoke?token=<token>` and clears the
settings.

### iPad/Safari quirk

The user gesture must be preserved when calling
`requestAccessToken`. If GIS isn't loaded yet, the app shows a toast
"Loading Google services… Tap Connect again" and lets the user re-tap
once GIS is ready. This is because Safari blocks `requestAccessToken`
after any async operation breaks the gesture chain.

## File discovery

```
GET https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='chapterwise-sync.json'
Authorization: Bearer <token>
```

If the file exists, store its ID. Otherwise create it via:

```
POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart
multipart body:
  metadata: { name: 'chapterwise-sync.json', parents: ['appDataFolder'] }
  file: '{}'
```

## Sync data shape

`getSyncDataForUpload(excludePdfData)` (`index.html:24054`) builds:

```jsonc
{
  "version": 1,
  "syncedAt": "<ISO>",
  "books": [ /* with pdfData base64 unless excluded */ ],
  "chapters": [ ... ],
  "progress": [ ... ],
  "generated": [ ... ],
  "settings": { /* whitelisted keys + custom prompts */ }
}
```

`syncableSettingKeys` whitelist (`index.html:24082`):

```
apiKey, merlinIdToken, merlinRefreshToken, merlinTokenExpiry,
merlinEmail, merlinModel, merlinWebAccess, merlinOCRMode,
lazybirdApiKey, lazybirdVoice,
googleTtsApiKey, googleTtsVoice,
juniaToken, juniaCreativity, juniaPersona, juniaGpt4,
docanalyzerApiKey, docanalyzerModel, docanalyzerAdherence,
vadooApiKey, vadooDuration, vadooVoice, vadooStyle, vadooTheme, vadooAspect
```

Plus all `prompt_*` keys for custom prompt overrides.

## Three actions

### Upload (`uploadToCloud`)

`index.html:24145`. Sends the entire local snapshot to Drive,
overwriting whatever's there. Confirms the user wants this since it can
overwrite cloud-only data.

### Download (`downloadFromCloud`)

`index.html:24204`. Replaces local IndexedDB contents with cloud data.
Asks for confirmation since it overwrites local-only edits.

### Sync (`syncNow`)

`index.html:24549`. The smart merge.

```
Stage 1: download cloud (60s timeout)
Stage 2: build local snapshot WITHOUT pdfData
Stage 3: merge metadata via mergeData()
Stage 4: importSyncDataIncremental(merged)
         (writes books, chapters, progress, generated to local IDB.
          Books with _pdfDataExcluded keep their existing pdfData.)
Stage 5: stream-build the upload Blob:
         '{"version":1,"syncedAt":"...","books":['
         + book1 (with base64 pdfData)
         + ',' + book2
         + ... + '],"chapters":' + JSON(chapters)
         + ',"progress":' + JSON(progress)
         + ',"generated":' + JSON(generated)
         + ',"settings":' + JSON(settings)
         + '}'
         (Each book is wrapped in a Blob individually so its base64 string
         is released to the GC after the Blob takes ownership of it.)
Stage 6: PATCH /upload/drive/v3/files/<id>?uploadType=media (120s timeout)
```

This streaming approach is what makes the app survive iOS Safari's
~300–500 MB heap limit even with libraries that exceed 100 MB.

### Merge algorithm

`mergeData(local, cloud)` (`index.html:24693`):

- For each store (books, chapters, progress, generated): merge by `id`.
  Local entries always win unless a `dateField` argument is provided.
  When date is provided, the more recent entry wins.
- Settings: local takes priority (current device wins).

`mergeArrayById(localArr, cloudArr, dateField)` (`index.html:24711`):

```js
const map = new Map();
for (const item of cloudArr) map.set(item.id, item);
for (const item of localArr) {
  if (dateField && map.has(item.id)) {
    if (Date(item[dateField]) >= Date(existing[dateField])) {
      map.set(item.id, item);
    }
  } else {
    map.set(item.id, item);   // local wins
  }
}
return [...map.values()];
```

## Memory-conscious patterns

### Why `_pdfDataExcluded`

The merge stage works only on metadata. Including base64-encoded PDFs at
this stage would inflate the working set by 4/3× the binary size. Books
that don't change between syncs don't need their PDF re-uploaded — so the
local snapshot used in `syncNow` sets `_pdfDataExcluded: true`. The
incremental import knows that flag means "keep the existing local
pdfData".

### Why streaming Blob assembly

A naïve `JSON.stringify(syncData)` would build the full string in JS heap
before fetching. For a library with 200 MB of base64 PDFs, that's a
500+ MB peak (string + Blob + fetch buffer). The streaming approach
hands ownership to native Blob memory as soon as a book is serialized.

### `arrayBufferToBase64` chunking

`index.html:24117`. Avoids `String.fromCharCode(...arr)` which O(n²)s on
large buffers in some engines. Processes in 8 KB chunks and joins.

## Failure modes

- **Token expired**: a 401 from Drive triggers `disconnectGoogleDrive()`
  and a "Session expired. Reconnect." toast.
- **Upload timeout**: 120 s `AbortController`. UX: "Upload timed out.
  Try with a better connection."
- **Download timeout**: 60 s.
- **Merge conflict resolution failure**: never happens because there are
  no schema-level conflicts (last-write-wins by date).

## Auto-sync on every save

There is no automatic background sync. The user clicks Sync Now or
Upload/Download manually. A future improvement is a debounced
auto-sync-on-write trigger; see [`24-future-development.md`](24-future-development.md).

Continue to [`18-pwa-and-service-worker.md`](18-pwa-and-service-worker.md).

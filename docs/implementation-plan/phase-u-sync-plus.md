# Phase O — Cloud & Sync Plus

> **Tagline:** Real-time, encrypted, multi-cloud, conflict-free.

## Goal

Upgrade the Phase F single-snapshot Drive sync into a robust,
real-time, end-to-end-encrypted, multi-cloud, CRDT-based sync layer
that handles concurrent edits across devices, supports several
storage backends, and never loses data.

## Why this phase / rationale

Phase F's "last write wins" works for solo users but breaks down for:
- **Two devices editing simultaneously** (annotations on iPad, notes
  on phone) — one device's edits silently overwrite the other.
- **Privacy-conscious users** who don't want their library readable
  by Google.
- **Users without Drive** (Dropbox, OneDrive, iCloud, self-hosted).
- **Background sync** so data survives even if the user never opens
  the tab on their other device.

CRDTs (Conflict-free Replicated Data Types) solve the merge problem
mathematically. Yjs is the de-facto standard for this in JS.

## Prerequisites

- Phase M (modular codebase + worker infra + plugin contracts).
- Phase F (the basic sync exists; this phase replaces it).

## Deliverables

- End-to-end encryption: user passphrase derives a key, sync JSON is
  encrypted before upload.
- Yjs CRDTs for chapter content and annotations (concurrent edits
  merge).
- Per-store delta sync (only changed entities round-trip).
- One-file-per-book PDF storage in cloud (smaller per-sync transfers).
- Sync provider plugin contract.
- Implementations: Google Drive (already), Dropbox, OneDrive, WebDAV
  (Nextcloud), S3-compatible (R2 / B2 / minio).
- Auto-sync on idle (debounced 30s after the last write).
- Background sync via `periodicsync` where supported.
- Real-time push via WebSocket (optional self-hosted "sync hub").
- Storage usage display in settings.

## Task breakdown

### O1 — Sync provider plugin contract

```ts
export interface SyncPlugin {
  id: string;
  displayName: string;
  isConfigured(): Promise<boolean>;
  authorize(): Promise<void>;
  list(): Promise<{ id: string; modifiedAt: Date; size: number }[]>;
  read(id: string): Promise<ReadableStream<Uint8Array>>;
  write(id: string, data: ReadableStream<Uint8Array> | Blob): Promise<void>;
  delete(id: string): Promise<void>;
  getQuota?(): Promise<{ used: number; total: number }>;
}
```

Streams in/out so giant libraries don't OOM the tab.

### O2 — Provider implementations

- `google-drive.ts` — refactor of Phase F.
- `dropbox.ts` — OAuth + REST API.
- `onedrive.ts` — Microsoft Graph.
- `webdav.ts` — generic WebDAV (Nextcloud, ownCloud, mailbox.org).
- `s3.ts` — AWS Signature V4 with user-supplied bucket + key.

Settings has a "Sync target" dropdown that picks the active
provider. Multiple providers can be configured but only one is the
active sync target.

### O3 — Per-store delta sync

Replace the single `chapterwise-sync.json` with a folder layout:

```
chapterwise/
├── meta.json                      # version, last-sync, vector clock
├── books-index.json               # all books without pdfData
├── books/
│   └── <book-id>/
│       └── source.pdf             # one file per book
├── chapters-index.json
├── chapters/
│   └── <chapter-id>.json          # OR Yjs binary update
├── annotations.json
├── progress.json
├── generated/
│   └── <chapterId>/
│       ├── feed.json
│       ├── summary.json
│       ├── lazybird-audio.mp3
│       └── ...
└── settings.json
```

Benefits:
- Books that don't change don't re-upload (saves the PDF round-trip).
- Heavy artefacts (audio, video, images) become first-class objects.
- Conflicts are localized — two devices editing different chapters
  don't even touch the same files.

### O4 — Encryption

Use libsodium-wrappers (WASM) in a worker:
```ts
// src/workers/crypto.worker.ts
import sodium from 'libsodium-wrappers';
await sodium.ready;

const api = {
  async deriveKey(passphrase: string, salt: Uint8Array): Promise<Uint8Array> {
    return sodium.crypto_pwhash(
      sodium.crypto_secretbox_KEYBYTES,
      passphrase,
      salt,
      sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_ALG_DEFAULT
    );
  },
  async encrypt(key: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array> {
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const cipher = sodium.crypto_secretbox_easy(plaintext, nonce, key);
    return concat(nonce, cipher);
  },
  async decrypt(key: Uint8Array, ciphertext: Uint8Array): Promise<Uint8Array> { ... }
};
```

Settings: "Set encryption passphrase". Key derivation via Argon2.

A salt is generated once per library and stored in `meta.json` (it's
fine for the salt to be public; the passphrase is the secret).

Encrypted-only mode: refuse to read unencrypted files when the
passphrase is set.

### O5 — Yjs CRDTs

Each chapter's content becomes a `Y.Doc`:
```ts
import * as Y from 'yjs';

const doc = new Y.Doc();
const ytext = doc.getText('content');
ytext.insert(0, chapter.content);
```

Annotations become a `Y.Array`. Tag arrays become `Y.Array`.

Each device persists its `Y.Doc` updates as binary deltas. Sync
uploads only the delta (a few hundred bytes for typical edits).

Provider stores `chapters/<id>.bin` as the latest snapshot plus a
`chapters/<id>.log/<seq>.bin` series of deltas. Compact periodically.

### O6 — Vector clock for top-level merge

`meta.json` carries a vector clock per device:
```jsonc
{
  "version": 2,
  "vectorClock": { "device-A": 42, "device-B": 17, "device-C": 5 }
}
```

Each device increments its own counter on every change. Sync merges
clocks; conflicts resolved by Y.Doc merge (free) or last-write-wins
on monotonic timestamps for non-CRDT data.

### O7 — Auto-sync on idle

```ts
let dirtyTimer: number | null = null;
function markDirty() {
  if (dirtyTimer) clearTimeout(dirtyTimer);
  dirtyTimer = setTimeout(() => syncNow(), 30_000);
}
```

Hook into every write path (chapter edits, annotations, completions,
settings).

Visual indicator: tiny status pill "Synced 3 minutes ago" / "Syncing
now…".

### O8 — Background sync (periodic)

For browsers that support it (Chrome desktop, Android Chrome):

```ts
await navigator.serviceWorker.ready;
await registration.periodicSync.register('headway-sync', {
  minInterval: 24 * 60 * 60 * 1000   // daily
});
```

In `sw.js`:
```js
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'headway-sync') {
    event.waitUntil(performBackgroundSync());
  }
});
```

For browsers without it, fall back to "sync on focus" + the in-tab
debouncer.

### O9 — Real-time WebSocket push (optional)

Self-hostable sync hub (Cloudflare Durable Object or simple Node
service):
- Each device connects with a library ID.
- Each upload broadcasts a "library X changed" message.
- Listening devices fetch the delta.

Default off (privacy-first). Settings → "Real-time sync hub" →
paste the WebSocket URL.

The hub never sees decrypted content (everything is encrypted
client-side). It just relays opaque update notifications.

### O10 — Storage usage display

`SyncPlugin.getQuota()` exposes `{ used, total }`.

Settings shows:
- "12.4 GB used of 15 GB Drive quota"
- Per-section breakdown:
  - Books (PDFs): 11.2 GB
  - Audio: 850 MB
  - Generated content: 320 MB
  - Annotations / progress / settings: <1 MB

"Free up space" actions:
- Remove unused audio.
- Strip PDFs from books (keeps text).
- Clear generated cache.

### O11 — Migration from Phase F

A user upgrading:
1. Detect old single-file `chapterwise-sync.json`.
2. Download it once.
3. Convert to the new folder structure on the cloud.
4. Mark migration done.
5. Future syncs use the new format.

### O12 — Multi-cloud testing

Set up integration tests for each provider on a CI test account.
Confirm:
- Auth works.
- List / read / write / delete round-trip.
- Quota reporting correct.
- Streaming uploads work.

## Acceptance criteria

- [ ] Two devices editing different chapters concurrently → both
      edits survive after sync.
- [ ] Two devices editing the **same** chapter → Yjs merges word-level
      edits without loss.
- [ ] Encryption: a sync file inspected with `cat` shows binary
      garbage, not readable text.
- [ ] Loss of passphrase = library is unreadable (document this
      clearly!).
- [ ] Dropbox sync works end-to-end.
- [ ] WebDAV sync works against a Nextcloud test instance.
- [ ] Auto-sync fires 30 s after a write.
- [ ] Background sync (where supported) fires once a day.
- [ ] Storage usage displays correctly.
- [ ] Phase F → Phase O migration works on a real account.

## Effort estimate

- **T-shirt:** L
- **Person-weeks:** 4–6
- **Critical path:** Yjs integration (rethinking how chapter content
  is stored and edited).

## Risks & unknowns

- **CRDT choice** — Yjs is mature but Automerge is competitive.
  Locking choice now matters.
- **Passphrase recovery** is impossible by design. Make this
  obvious in onboarding.
- **WebDAV variability** — different servers behave subtly differently.
  Test against at least Nextcloud + ownCloud + raw nginx-webdav.
- **iCloud Drive** has no public REST API for browser apps. Skip it.
- **Periodic Background Sync** is Chrome-only and has tightening
  restrictions. Don't depend on it.

## Out of scope

- Multi-user collaboration (Phase R).
- Real-time presence (cursors, selections) (Phase R).
- File versioning / undo across devices (Phase R).

## Decision points before Phase P

- [ ] Confirm Yjs vs Automerge.
- [ ] Confirm whether to default-on auto-sync (recommend yes for
      sync-target users; ask first time).
- [ ] Decide whether to ship the WebSocket hub as a paid service or
      self-host-only (recommend self-host-only for privacy story).

---

Continue to [Phase P — Audio Plus](phase-p-audio-plus.md).

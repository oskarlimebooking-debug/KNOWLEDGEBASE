# Sprint U: Sync Plus — CRDT (Yjs), E2EE, multi-cloud, real-time, per-store delta

> One task per T-item in `docs/implementation-plan/phase-u-sync-plus.md` (O1–O12 in source doc).
> Upgrade sprint F single-snapshot sync into a robust, real-time, end-to-end-encrypted, multi-cloud, CRDT-based layer.

### Phase 1: Plugin contract + provider impls

### TU.1 -- Sync provider plugin contract | Cx: 8 | P0

**Description:** Define `SyncPlugin` interface (read / write / list / delete / watch). Build on sprint G's plugin pattern.

**AC:**
- [ ] Interface published with TSDoc
- [ ] Vitest mock implementation
- [ ] Migration path from sprint F's hard-coded Drive

**Depends on:** TG.6

### TU.2 -- Provider implementations (Drive / Dropbox / iCloud / S3) | Cx: 21 | P1

**Description:** Implement at least 2 of the 4. Each authenticates per-provider; OAuth flow per cloud.

**AC:**
- [ ] At least Drive + Dropbox implemented (others stubbed)
- [ ] OAuth flow respects iOS-Safari user-gesture
- [ ] Test-connection per provider

**Depends on:** TU.1

### Phase 2: Delta sync + encryption

### TU.3 -- Per-store delta sync | Cx: 13 | P0

**Description:** Track changed rows per store via change-tracking journal. Upload only deltas.

**AC:**
- [ ] Delta computed correctly on add/update/delete
- [ ] Bandwidth measurably reduced vs full snapshot
- [ ] Conflict resolution via Yjs (TU.5)

**Depends on:** TU.1

### TU.4 -- Encryption (libsodium / Web Crypto) | Cx: 13 | P0

**Description:** End-to-end encrypted envelope. Key derived from user passphrase + KDF.

**AC:**
- [ ] Envelope undecodable without passphrase
- [ ] KDF (Argon2id) tuned to ≥ 250ms
- [ ] Recovery doc clear about key loss
- [ ] Vitest covers encrypt/decrypt round-trip

**Depends on:** TG.7

### TU.5 -- Yjs CRDTs | Cx: 21 | P0

**Description:** Replace last-write-wins on critical stores (annotations, chapters, projects) with Yjs documents. Update IDB write path to go through Yjs.

**AC:**
- [ ] Concurrent edits on two devices converge correctly
- [ ] No data loss in 100 random-merge fixtures
- [ ] Migration: pre-U data converts to Yjs doc cleanly
- [ ] Vitest covers convergence

**Depends on:** TU.3

### TU.6 -- Vector clock for top-level merge | Cx: 8 | P1

**Description:** Per-device vector clock attached to envelope. Detect concurrent updates.

**AC:**
- [ ] Vector clocks merge correctly
- [ ] Stale uploads detected and rejected
- [ ] UI surfaces "concurrent edit detected"

**Depends on:** TU.5

### Phase 3: Auto / real-time / background

### TU.7 -- Auto-sync on idle | Cx: 5 | P1

**Description:** Trigger sync after 30s idle. Cancel on activity.

**AC:**
- [ ] Idle detection accurate
- [ ] Cancellation works mid-flight
- [ ] User can disable

**Depends on:** TU.3

### TU.8 -- Background sync (periodic) | Cx: 8 | P1

**Description:** Service Worker `periodicSync` for browsers that support it. Fallback: sync on next foreground.

**AC:**
- [ ] Works on Chrome desktop / Android
- [ ] Documented limitation on iOS
- [ ] User can disable

**Depends on:** TG.12, TU.3

### TU.9 -- Real-time WebSocket push (optional) | Cx: 13 | P2

**Description:** Optional WebSocket relay for instant multi-device updates. Self-hosted endpoint.

**AC:**
- [ ] Sub-second propagation on local network
- [ ] Graceful degradation when relay offline
- [ ] No mandatory hosting (opt-in)

**Depends on:** TU.5

### Phase 4: Storage + migration + multi-cloud

### TU.10 -- Storage usage display | Cx: 3 | P2

**Description:** Settings shows quota / usage per cloud.

**AC:**
- [ ] Accurate within 5%
- [ ] Updates after each sync
- [ ] Warning at 80% quota

**Depends on:** TU.2

### TU.11 -- Migration from sprint F | Cx: 5 | P0

**Description:** Existing Drive sync users migrate to new envelope. Backup-first.

**AC:**
- [ ] 50-source library migrates cleanly
- [ ] Backup written to local IDB before mutating cloud
- [ ] Rollback documented

**Depends on:** TF.7, TU.3

### TU.12 -- Multi-cloud testing | Cx: 5 | P1

**Description:** Same library across Drive + Dropbox. Verify identical post-sync.

**AC:**
- [ ] Cross-cloud sync converges
- [ ] No data loss in stress test (1000 random edits across 2 devices)

**Depends on:** TU.5

---

## Sprint enforcement gates (must pass before Sprint V begins)

- [ ] **G-AC** — all task AC ticked
- [ ] **G-Tests** — Yjs convergence ≥ 100 random fixtures pass; encryption round-trip ≥ 100%
- [ ] **G-Security** — passphrase recovery doc reviewed; KDF tuning verified
- [ ] **G-Manual** — Two-device stress test (1000 edits) green
- [ ] **G-State** — `state.md` updated

**Decision points before Sprint V:**

- [ ] Default cloud for new users
- [ ] Mandatory encryption (recommended: opt-in but strongly encouraged)

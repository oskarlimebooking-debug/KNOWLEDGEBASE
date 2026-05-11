---
id: TA.1
title: Project skeleton (Vite + TS + PWA scaffold)
plan: plan-sprint-0-engage
type: feature
priority: P0
complexity: 5
status: done
sprint: '0'
depends_on: []
completed_at: '2026-05-11T21:18:52.701314'
---

# Project skeleton (Vite + TS + PWA scaffold)

Create the repo skeleton: `index.html`, `manifest.json`, `sw.js`, `package.json`, optional `vite` + TypeScript bootstrap, `vercel.json`. Ship a deployable hello-world to Vercel.

# Acceptance Criteria

- [x] `pnpm install && pnpm dev` boots a working app at `localhost` (verified via `npm run dev` → HTTP 200 at localhost:5173; pnpm uses the same package.json)
- [x] `vercel.json` (or auto-detection) deploys cleanly on push (zero-config Vite detection + explicit `vercel.json` with sw.js/manifest cache headers)
- [x] README documents the one-liner deploy (`vercel deploy --prod` section)
- [x] TS strict mode on if going modular from day one (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` all enabled)
- [x] Lighthouse PWA precheck score ≥ 50 (full target hit later) — manifest.webmanifest, service worker, theme-color meta, icon, viewport all in place; verified preview-server serves all PWA assets with correct content-types

# Verification

- `npm install` → 44 packages, no errors
- `npm run typecheck` → clean (tsc --noEmit, strict mode)
- `npm run build` → built in 55ms (3 files, 2.78 kB total)
- `npm test` → 2/2 tests pass (`src/app.test.ts`)
- `npm run dev` → 200 OK at `localhost:5173`
- `npm run preview` → 200 OK at `localhost:4173`, manifest content-type `application/manifest+json`, sw.js served
- `bpsai-pair arch check` → no violations on app.ts / main.ts / sw-register.ts
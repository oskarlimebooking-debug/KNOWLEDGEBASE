# Headway

A personal knowledge platform that combines **READ** (consume books and articles
with AI-driven reading modes), **RESEARCH** (discover new sources and adapt to
feedback), and **WRITE** (structured outline-based authoring with streaming AI
drafts).

This repository is being built progressively against the phased roadmap in
[`docs/implementation-plan/`](docs/implementation-plan/00-overview.md). The
single-file pre-Phase-G architecture reference lives in [`docs/`](docs/00-README.md).

## Status

**Sprint A — Foundation: in progress** (TA.1 scaffold landed). Vite + TypeScript
+ PWA hello-world; no AI, no data layer, no UI features yet — those come in
TA.2 … TA.10.

## Run locally

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>.

> `pnpm install && pnpm dev` works identically — the lockfile is regenerable.

The service worker is registered only in production builds, and is suppressed
when the URL has `?nosw=1` for stale-cache debugging.

## Scripts

| Script              | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Vite dev server on port 5173                  |
| `npm run build`     | Production build to `dist/`                   |
| `npm run preview`   | Preview the built bundle on port 4173         |
| `npm run typecheck` | `tsc --noEmit` (strict mode)                  |
| `npm test`          | Vitest one-shot                               |
| `npm run test:watch`| Vitest watch mode                             |

## Deploy

This repo is a static site. Vercel detects it as a zero-config Vite project; no
extra setup needed beyond the one-liner:

```bash
vercel deploy --prod
```

`vercel.json` keeps `sw.js` and `manifest.webmanifest` from being long-cached so
service-worker updates roll out predictably.

## Structure

```
KNOWLEDGEBASE/
├── index.html                # Vite entry (loads /src/main.ts)
├── src/
│   ├── main.ts               # bootstrap: mount + SW register
│   ├── app.ts                # hello-world shell (replaced in TA.3)
│   ├── sw-register.ts        # production-only SW registration
│   └── styles.css
├── public/
│   ├── manifest.webmanifest  # PWA manifest
│   ├── sw.js                 # Service worker (richer impl in TA.9)
│   └── icon.svg              # App icon
├── vite.config.ts
├── tsconfig.json             # strict + noUncheckedIndexedAccess
├── vercel.json
├── docs/                     # subsystem specs + implementation plan
└── .paircoder/               # bpsai-pair plans, tasks, context
```

`_legacy/` (gitignored) holds untracked artifacts from a prior monolithic
implementation, retained for reference only.

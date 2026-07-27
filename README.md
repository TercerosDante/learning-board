# Learning OS

Personal, local-first web app for structuring and sustaining self-directed study.
See `docs/product-brief.md` (what & why), `docs/architecture.md`, `docs/data-model.md`,
`docs/implementation-plan.md` (design), `docs/open-decisions.md` (decision log).

## Status

Phase 3 (retention): everything from phases 1–2, plus a minimal spaced-repetition
scheduler (fixed 1/3/7/14/30/60/120-day ladder, pass/fail), automatic needs-review
transitions, a review queue in the Review surface, the retention metric on the
dashboard, and daily metric snapshots. All data lives in this browser's IndexedDB —
**export regularly; the backup file is the only safety net.**

## Development

- `npm install`
- `npm run dev` — local dev server
- `npm test` — run the test suite
- `npm run build` — production build to `dist/`

# Learning OS

Personal, local-first web app for structuring and sustaining self-directed study.
See `docs/product-brief.md` (what & why), `docs/architecture.md`, `docs/data-model.md`,
`docs/implementation-plan.md` (design), `docs/open-decisions.md` (decision log).

## Status

Phase 1 (walking skeleton): areas & items, study sessions, consistency metrics,
markdown notes, full export/import. All data lives in this browser's IndexedDB —
**export regularly; the backup file is the only safety net.**

## Development

- `npm install`
- `npm run dev` — local dev server
- `npm test` — run the test suite
- `npm run build` — production build to `dist/`

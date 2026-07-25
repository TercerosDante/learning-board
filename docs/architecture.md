# Learning OS — Architecture

> Deliverable 1 of 3 for [product-brief.md](product-brief.md) §10. Companion documents:
> [data-model.md](data-model.md), [implementation-plan.md](implementation-plan.md),
> [open-decisions.md](open-decisions.md).

## 1. Shape of the application

A single-page TypeScript web application, installable as a PWA, with **all data in IndexedDB** on the
user's device. No backend, no accounts (§1, §8). The app is organized as three layers with a strict
dependency direction:

```
┌─────────────────────────────────────────────────┐
│  ui/        React components, routes, hooks      │
│             (Dashboard · Plan · Study · Review)  │
├─────────────────────────────────────────────────┤
│  services/  application commands                 │
│             startSession, logAttempt, triage…    │
├─────────────────────────────────────────────────┤
│  domain/    pure TypeScript, zero dependencies   │
│             types · lifecycle · SRS · metrics ·  │
│             backup format                        │
├─────────────────────────────────────────────────┤
│  data/      Dexie (IndexedDB) repositories,      │
│             schema versions, migrations          │
└─────────────────────────────────────────────────┘
```

- **`domain/`** imports nothing from React or Dexie. It holds the entity types, the item lifecycle
  state machine, the spaced-repetition scheduler, the three metric calculators, and the export/import
  file format. Everything here is a pure function over plain data — trivially unit-testable, and the
  part of the app that must survive any future change of storage or UI.
- **`data/`** implements repository interfaces defined against domain types. The UI never touches
  IndexedDB directly. Swapping or augmenting storage (a future sync adapter, §8) means writing a new
  implementation of these interfaces, not touching callers.
- **`services/`** are thin application commands that orchestrate: validate via domain logic, write via
  repositories. All mutations go through here; components never write to the database directly.
- **`ui/`** renders and subscribes. One route per moment (§4) plus a dashboard.

**Why this and not less:** a flat "components read/write Dexie directly" app would be faster to start
but couples every screen to the storage schema, making the two futures the brief reserves room for
(sync backend, AI proposals — §8) rewrites instead of additions. The layering costs little because the
domain surface is small.

**Why this and not more:** no event sourcing, no CRDTs, no state-management framework beyond what the
storage layer's reactivity provides. Single user, single device, personal-scale data (§2) — the
complexity would buy nothing now. Sync-friendliness is achieved cheaply in the data design instead
(UUIDs, `updatedAt` on every row, append-only history tables — see data-model.md §6).

## 2. Proposed stack, with alternatives considered

These are recommendations with reasoning; the layering above is the real commitment, the stack choices
are replaceable within it.

| Concern | Recommendation | Alternatives considered — why not |
|---|---|---|
| Language/build | TypeScript + Vite | Non-negotiable given a technically fluent solo user; nothing else considered seriously. |
| UI framework | **React 18** | *Svelte/SolidJS*: lighter, but the best embeddable canvas (Excalidraw) is a React component, and ecosystem breadth matters more than runtime weight for a local tool. *No framework*: the UI surface (canvas, editors, live metrics) is too large. |
| Storage | **Dexie.js over IndexedDB** | *Raw IndexedDB*: needless boilerplate. *localStorage*: size limits, no indexes — disqualified. *SQLite-WASM + OPFS*: real SQL is tempting for metric queries, but heavier setup, worse reactivity story, and personal-scale data doesn't need it. *RxDB*: built for sync we're not building; heavy. |
| Reactivity | **Dexie `liveQuery` + `dexie-react-hooks`** | The database is the single source of truth; components subscribe to queries and re-render when underlying tables change. *A mirrored store (Zustand/Redux)*: introduces a second copy of state to keep consistent — the classic bug farm. *Manual pub/sub*: reinvents liveQuery. |
| Canvas | **Excalidraw (embedded component)** | MIT-licensed, serializes scenes to JSON (stored as artifact payload), supports shape *libraries* — which directly implements UC-2's reusable templates (load balancer, cache, queue…). *tldraw*: watermark/license terms. *Custom SVG*: months of work for a worse result. |
| Markdown | **CodeMirror 6 editor + unified/remark preview**, syntax-highlighted code blocks | *WYSIWYG (TipTap/Milkdown)*: heavier, and the user is explicitly Markdown-fluent (§2). *Plain textarea*: acceptable fallback for phase 1. |
| Video | **YouTube iframe API (URL embeds) in v1** | Local video files need the File System Access API with re-permission prompts — deferred; see open-decisions.md D-7. Timestamp-anchored notes work against the iframe player's `currentTime`. |
| Offline | **Vite PWA plugin** (app shell cached by service worker) | The data is already local; this just makes the *app* load without network. Small cost, obvious win for a tool used on train rides and flights. |

## 3. Data flow and reactivity

Unidirectional, with the database as the single source of truth:

```
user action ─▶ service command ─▶ domain validation ─▶ repository write ─▶ IndexedDB
                                                                              │
     UI re-render ◀── liveQuery subscription fires ◀──────────────────────────┘
```

- **Reads:** components call `useLiveQuery(() => repo.query(...))`. There is no client-side cache to
  invalidate; Dexie observes the tables a query touched and re-runs it on change.
- **Writes:** always through a named service command (`startSession`, `stopSession`, `capture`,
  `logAttempt`, `recordReview`, `triageCapture`, `importBackup`, …). This gives one choke point for
  invariants (e.g., *at most one active session*) and later for an undo log or a sync journal.
- **Derived metrics are computed on read, not stored.** Coverage, retention, and consistency (§7) are
  pure functions in `domain/metrics` over the queried rows. At personal scale (thousands of rows,
  not millions) this is fast, and it eliminates a whole class of stale-counter bugs. The one
  exception: a small daily `MetricSnapshot` cache so the retention *trend* chart doesn't recompute
  history — see data-model.md §5 and open-decisions.md D-10.

## 4. The moments as surfaces

Four top-level routes, mapping §4's interaction model onto navigation. The cognitive-load contract of
each moment is an *architectural* constraint, not a styling choice:

- **Dashboard (home)** — the three numbers (§7) per area and globally; read-only.
- **Plan** — the only surface with metadata editors: create/arrange areas, topics, items; set
  estimates and weekly targets; attach references; lay out the week.
- **Study** — engineered for near-zero interaction: resume-last or pick-and-start, one visible
  timer, and *optional* capture affordances (note editor, canvas, one-tap attempt result). The rule
  from §3 is enforced structurally: **components rendered on the Study route must not contain a
  required input.** No modal on stop. This is a checkable rule (a lint-able convention and a review
  checklist item), not an aspiration.
- **Review** — the deferred-organization surface: capture-inbox triage, the SRS due queue,
  lifecycle/status changes, backup reminder banner, plan adjustments.

A **global quick-capture** (keyboard shortcut, available on every route) writes to the inbox with
automatic context — active session, item, and route recorded for free (UC-8).

## 5. Cross-cutting components

**Session engine.** One active session at most, represented as a row with `endedAt = null` and
persisted immediately on start — a crash or tab close loses nothing. On next launch, a stale open
session is surfaced for trimming (see open-decisions.md D-4); the app never silently discards or
silently keeps suspicious data.

**SRS scheduler.** A pure function `(reviewState, outcome, today) → nextReviewState` implementing a
fixed interval ladder (deliberately simpler than a full SRS tool, §8). Because it is pure, the
"simplified now, tunable later" requirement is contained in one file. Details in data-model.md §4.

**Timer service.** Count-up for sessions, countdown for timed exercises (UC-1/2/7). Wall-clock-based
(timestamps, not tick accumulation) so backgrounded tabs stay correct.

**Export/import.** A first-class module, present from the first phase (§9): serialize the entire
database to one versioned JSON file; import validates the version, migrates forward if older, and
**auto-exports the current state before replacing it** so import can never destroy data. The backup
reminder (driven by `lastExportAt`) surfaces only in the Review moment — a nudge in the low-pressure
moment, never a nag during study (§2, §3).

**Migrations.** Dexie's versioned schema upgrades, with the schema version embedded in every export
file. Committing to migrations in phase 1 is what makes "no painful migration later" (§8) true.

## 6. Room reserved, not built (§8)

- **Sync/backend later:** all IDs are UUIDs, every row carries `updatedAt`, and history tables
  (sessions, attempts, review log, captures) are append-only. A future sync engine gets
  last-write-wins on state tables and trivial union-merge on history tables without a data-model
  rewrite. Real conflict resolution is future work and is *not* pre-built.
- **AI later:** the "AI proposes; the user disposes" principle (§8) maps onto an architectural seam:
  any future assistant emits **proposal objects** that surface in the Review moment for explicit
  acceptance — the same shape as inbox triage. No proposal machinery is built now; the point is that
  the Review surface is where it would plug in, so nothing needs restructuring.

## 7. Testing strategy

- **`domain/`** — thorough unit tests; this is where correctness lives (SRS ladder, lifecycle
  transitions, metric math, streak/day-boundary edge cases, backup round-trip).
- **`data/`** — integration tests against `fake-indexeddb`: repository contracts and every migration
  (old fixture → migrate → validate).
- **`ui/`** — a handful of interaction tests for the friction-critical paths (start/stop study,
  quick capture, one-tap attempt); no exhaustive component testing.
- **Invariant checks** worth encoding as tests from day one: *no required input on the Study route*;
  *export→import round-trips losslessly*; *at most one open session*.

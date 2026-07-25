# Learning OS — Phased Implementation Plan

> Deliverable 3 of 3 for [product-brief.md](product-brief.md) §10. Companion documents:
> [architecture.md](architecture.md), [data-model.md](data-model.md),
> [open-decisions.md](open-decisions.md).

## Ground rules (hold in every phase)

1. **Every phase ends with a usable app** — plan a little, study, see at least one honest metric.
   No infrastructure-only phases (§10).
2. **Export/import ships in phase 1 and never regresses** (§9). Every later schema change comes
   with a migration and an export-format bump, tested against old fixture files.
3. **The §10 litmus tests are exit criteria for every phase:** no required input on the Study
   route; no per-area special case in the model.
4. **Artifact and history tables exist from phase 1**, even while mostly empty — later phases add
   artifact *types* and UI, which is additive (data-model.md §2), not migratory.

## Phase 1 — Walking skeleton: *track time, keep notes, never lose data*

**Goal:** the smallest app the target user could adopt tonight and trust.

- Project scaffolding with the four-layer structure (architecture.md §1); Dexie schema v1
  (all tables), migration harness, domain test setup.
- Areas with profile presets; items (all four kinds as plain rows; `markdown` artifact only,
  simple editor + preview).
- **Session engine**: start/stop from an area or item, persistent active session, manual entry,
  stale-session recovery on relaunch.
- **Consistency metric**: minutes this week vs target, streak. Minimal dashboard.
- **Full export/import** with auto-backup-before-import; `lastExportAt` tracked.

**Usable end-to-end?** Yes: UC-5 is *fully* served already (minimal area + done-tick attempts +
streak — done-tick is just `Attempt{pass}`, so the Attempt table earns its keep in phase 1), and
UC-3's core (time logging + notes) works. — **Friction check:** the only required action anywhere
is start/stop (§4). ✓

## Phase 2 — The loop: *capture anything, triage weekly, see coverage*

**Goal:** make the three-moment cycle (§4) real in navigation and habit.

- **Global quick-capture** (shortcut everywhere) with automatic context stamping; inbox (UC-8).
- **Review surface**: inbox triage (promote to item / attach to item / dismiss), manual lifecycle
  changes, backup-reminder banner.
- **Plan surface**: topics, item arranging, estimates, `WeekPlan` (per-area targets + focus items).
- **Coverage metric** joins the dashboard; item lifecycle statuses live (manual transitions only).

**Usable end-to-end?** Plan → Study → Review is now the app's shape; UC-8 fully served.
— **Friction check:** capture adds zero required fields; triage lives only in Review. ✓

## Phase 3 — Retention: *the reason this product exists*

**Goal:** the metric no other tool has (§1), honestly derived.

- **SRS scheduler** (fixed ladder, pass/fail — data-model.md §4) with full unit-test coverage;
  `review` state on items, on-by-default per profile.
- **Review queue** in the Review surface: self-assessment prompts for note/reading items;
  `needs-review` automatic transitions; `ReviewLog` written for every outcome.
- **Retention metric** on the dashboard; daily `MetricSnapshot` begins accumulating so the trend
  chart (this phase or next) has history from day one of phase 3.

**Usable end-to-end?** All three §7 numbers are now live. — **Friction check:** reviews happen
only in the Review moment; due items *appear* there, they never interrupt Study (T-2). ✓

## Phase 4 — Practice: *attempts, patterns, timed exercises*

**Goal:** serve the practice-heavy use cases with the machinery UC-7 will reuse.

- **Attempt logging UI**: one-tap result (pass / with-help / fail) + auto duration on practice
  items; attempt history on the item view.
- **Pattern weakness view**: aggregation of attempt results by `pattern:` tag (UC-1).
- **Timed exercise mode**: countdown from `exerciseConfig`, rubric checklists, attempt records
  planned-vs-actual (UC-1, UC-7).
- **Attempts feed SRS** for practice items (`sourceAttemptId` unification — data-model.md §4).

**Usable end-to-end?** UC-1 fully served; UC-7 served except cross-area linking (see strain #1).
— **Friction check:** the result tap is *optional capture*, not a required input — skipping it
still records the session; nothing blocks stopping. This is the phase most at risk of violating §3;
the exit review must verify it. ✓

## Phase 5 — Rich artifacts: *canvas and video*

**Goal:** the diagram-first and media-anchored use cases.

- **Canvas artifacts**: embedded Excalidraw; starter template library (load balancer, cache,
  replicated DB, queue — UC-2); attempt-owned editable snapshots wired into timed exercises.
- **Video artifacts**: URL embed + timestamp-anchored notes ("pin note at current time" — UC-3).
- **Applied-here** link artifacts and project subtask checklists get their full UI (UC-4).

**Usable end-to-end?** All eight use cases now served (UC-2, UC-3, UC-4, UC-6 complete).
— **Friction check:** canvas and video are capture surfaces — zero new required inputs. ✓

## Phase 6 — Comfort and resilience *(small, user-visible polish — no new model surface)*

- Keyboard-driven navigation / command palette (the §2 user is keyboard-fluent).
- PWA offline shell; responsive pass for tablet-on-the-couch reading.
- Retention **trend chart** from accumulated snapshots, if not already landed in phase 3/4.
- Import merge-mode exploration only if real usage demands it (D-9).

## Sequencing rationale

- **Consistency before retention** (phase 1 vs 3): §1's ordering, but also causality — every metric
  is only as truthful as the logging habit beneath it, so the habit-forming loop ships first.
- **Export in phase 1** is non-negotiable per §9 — it is the only safety net.
- **Capture/Review before SRS**: the Review *moment* must exist as a habit before the review
  *queue* has a home to live in (§4).
- **Canvas/video last among the big features**: highest implementation weight, and the artifact
  model makes them purely additive — waiting costs nothing structurally (data-model.md §2).
- **UC coverage is front-loaded where cheap**: UC-5 complete in phase 1, UC-8 in phase 2 — early
  proof that the generic model, not per-area modules, is carrying the product.

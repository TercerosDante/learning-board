# Learning OS — Open Decisions and Tensions

> The final §10 deliverable: everywhere the [brief](product-brief.md) states a *what* without a
> *how*, and every point where two of its requirements pull against each other. Each entry carries a
> recommendation so this doubles as a decision checklist before implementation. Companion documents:
> [architecture.md](architecture.md), [data-model.md](data-model.md),
> [implementation-plan.md](implementation-plan.md).

## A. Decisions the brief leaves open

**D-1 · SRS specifics.** The brief mandates "simplified" (§8) but not the ladder, grading scale, or
what mastery means numerically. *Recommendation:* fixed ladder 1/3/7/14/30/60/120 days, pass/fail
only, `mastered` = a pass at the 120-day rung, mastered items keep repeating at 120 days so mastery
stays honest (§7). Revisit rungs after real use; the scheduler is one pure function.

**D-2 · What "coverage" counts.** Statuses in the numerator are defined (data-model.md §5), but:
count items equally, or weight by `estimateMinutes`? *Recommendation:* count-based v1 — estimates
will be sparse and unweighted numbers are legible; keep estimates so weighting is a later toggle.

**D-3 · Streak semantics.** What keeps a streak alive, and where's the day boundary?
*Recommendation:* any session **or** attempt on a local-calendar day counts; no minimum minutes (a
threshold is a judgment, and §3 says don't judge during study); global streak on the dashboard,
per-area streaks on area pages. No grace days in v1 — a streak that can't break isn't information.

**D-4 · Forgotten-open-session handling.** The user will sometimes forget to stop the timer.
*Recommendation:* never auto-discard; on next launch, offer a one-tap trim ("ended when the app
closed?") — a Review-flavored correction, not mid-study friction. Sessions stay append-only;
corrections adjust `endedAt` and set an `edited` flag.

**D-5 · How prescriptive is the weekly plan?** §4 says "laying out a weekly schedule" — calendar
slots, or intentions? *Recommendation:* intentions only — per-area target minutes plus a short
focus-item list (`WeekPlan`). Calendar slots invite plan-maintenance overhead, which is organize-
work leaking toward daily life (§3). Revisit only if real usage shows drift.

**D-6 · How visible is "needs-review"?** Due counts could badge the nav, the dashboard, area pages…
*Recommendation:* passive number in the Review surface and dashboard retention breakdown only. No
badges on the Study route, no toasts, no notifications, ever (§2 "no nagging"; see T-2).

**D-7 · Video sources.** YouTube-style URL embeds are easy; local files need the File System Access
API and re-permission churn. *Recommendation:* URL embeds only in v1; keep video-note payloads
player-agnostic (`{seconds, text}`) so a local-file player is additive later. Also open: whether
video notes should later be extracted into queryable rows for global search (data-model.md strain #2).

**D-8 · Canvas templates.** Excalidraw shape libraries vs prefab starter scenes. *Recommendation:*
ship a starter shape library (UC-2's load balancer, cache, replicated DB, queue) — native Excalidraw
mechanism, user-extensible for free; prefab scenes only if libraries prove too granular.

**D-9 · Import semantics.** Replace or merge? *Recommendation:* replace-only in v1, always preceded
by an automatic export of the current state (architecture.md §5). Merge is a sync-problem in
disguise (§8 says don't build sync now); explore it only if a real two-device workflow emerges.

**D-10 · Retention trend derivation.** Recompute history from `ReviewLog` on demand, or accumulate
daily `MetricSnapshot` rows? *Recommendation:* snapshots (cheap, simple, rebuildable); accept that
the trend starts at phase 3's launch rather than being retro-computed.

**D-11 · Topic depth.** Flat topics, nested topics, or none? *Recommendation:* one optional flat
level. Nesting is organize-surface the target user (§2) will tinker with instead of studying.

**D-12 · UC-7's cross-area references.** Interview-prep items pointing at items in other areas:
`link` artifacts (second-class) vs a first-class `ItemRef` relation. *Recommendation:* link
artifacts in v1; promote to `ItemRef` only when backlinks or rollups are actually missed. This is
the model's weakest joint (data-model.md strain #1) — decide with usage data, not upfront.

**D-13 · Item kinds: fixed or user-definable?** *Recommendation:* the four fixed kinds
(note/practice/project/reading). User-defined templates are a plausible v2, but v1 needs the
genericity claim tested before it needs an extension mechanism.

**D-14 · Backup reminder cadence.** §9 mandates a reminder, not its rhythm. *Recommendation:*
banner in the Review surface when `lastExportAt` > 14 days (or never). Review-only placement keeps
it out of the study moment (T-5).

## B. Tensions between requirements

**T-1 · Attempt logging (UC-1) vs "no input during study" (§3).** An attempt's result and duration
are recorded *at study time* — exactly where §3 forbids demands. *Resolution:* the result is
one tap, and it is **optional capture, not required organize**: skipping it still records the
session; nothing blocks stopping. It passes §3's own rule — the result changes real decisions
(pattern weakness, SRS scheduling) — but this is the single most §3-endangered interaction in the
product, and phase 4's exit review exists to police it.

**T-2 · Automatic "needs-review" (§7) vs "no pressure, no nagging" (§2).** A system that flags decay
can feel like a system that scolds. *Resolution:* the state changes automatically, but the *signal*
lives only in Review-moment surfaces (D-6). The queue is a shelf you visit weekly, not a bell that
rings.

**T-3 · The streak (UC-5, §7) vs "not to gamify" (§2).** A streak is the most gamified mechanic in
software. *Resolution:* streak as neutral information — a number, no rewards, no flame icons, no
loss-aversion theatrics when it breaks. If it breaks, it just shows the new number.

**T-4 · "Not a full SRS clone" (§8) vs "spaced repetition is essential" (UC-1) + trend requires
history (§7).** Minimal SRS pulls toward no history; the trend requirement pulls toward more.
*Resolution:* minimal *algorithm* (fixed ladder, pass/fail), maximal *record* (`ReviewLog` for every
outcome). Simplicity where it's felt (grading UX), completeness where it's cheap (append-only rows).

**T-5 · Export reminders (§9) vs "no nagging" (§2).** The only safety net must be remembered without
becoming a pest. *Resolution:* reminder confined to the weekly Review moment (D-14) — the one
moment designed to absorb administrative load.

**T-6 · One generic model (§5) vs UC-5's rejection of everything.** Genericity via capability flags
risks profile sprawl — each new flag is a config surface the user must understand. *Resolution:*
a closed set of ~6 capabilities, presets as the only UI, new flags require the same justification as
new fields (§3's rule). The data-model's strain #4 names this the discipline to watch.

**T-7 · Local-first single-device (§1) vs "syncable later without painful migration" (§8).** True
sync-readiness (CRDTs, event sourcing) would dominate the v1 design for a feature that may never
come. *Resolution:* the cheap 80% — UUIDs, `updatedAt`, append-only history (data-model.md §6) —
and explicit acceptance that real sync will still need real merge work later. What's bought is "no
*data-model* rewrite", not "sync for free".

**T-8 · "Capture attaches automatically" (§4) vs capture outside any context (UC-8).** A shower
thought at the Plan screen has no session or item to attach to. *Resolution:* context is
best-effort, empty context is legal, and the inbox is precisely the home for unanchored captures —
that's why it exists.

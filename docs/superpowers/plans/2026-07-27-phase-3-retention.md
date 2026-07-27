# Phase 3 — Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The metric no other tool has (brief §1): a minimal SRS scheduler (fixed ladder, pass/fail — data-model.md §4), automatic `needs-review` transitions, a review queue in the Review surface, the retention metric on the Dashboard, and daily `MetricSnapshot` accumulation — per `docs/implementation-plan.md` Phase 3.

**Architecture:** unchanged four layers. New pure domain (`srs.ts`, `retention.ts`), two service modules (`reviews.ts`, `snapshots.ts`), a small `items.ts` extension, new queries, and additive UI on Review/Dashboard/Study. Stack: as phase 2 (shadcn/ui conventions, Radix test harness).

## Global Constraints

- **NO schema change.** `reviewLog` and `metricSnapshots` tables exist (empty) since schema v1; `Item.review` is embedded. Export format unchanged.
- **SRS is deliberately minimal (brief §8):** fixed ladder `[1, 3, 7, 14, 30, 60, 120]` days, pass/fail only, no ease factors. Maximal record: a `ReviewLog` row for EVERY outcome (§7 trend requirement).
- **Exactly two automatic status transitions exist after this phase** (data-model.md §3): `learned|mastered → needs-review` (due date passed via sweep, or a failed review) and `→ mastered` (passing a review at the top rung). Everything else stays manual.
- **Signals passive and Review-scoped (D-6):** the queue lives ONLY in the Review surface; the Dashboard shows numbers; no nav badges, no toasts, nothing on Study.
- `dueDate` is a local **dayKey string** (`YYYY-MM-DD`, lexicographically comparable), consistent with the codebase's local-midnight rule.
- Conventions as phase 2: `crypto.randomUUID()`; ISO `createdAt/updatedAt`; injectable `now`; explicit vitest imports; shadcn primitives; `setupUser`/`pickOption` for Radix; no `db` imports in src/ui outside tests.
- **Fold-in debt:** the phase-2 final-review minor — focus-list items of ARCHIVED areas remain startable — is fixed in Task 5 via a `focusItems` query.

## File Structure (delta)

```
src/domain/    + srs.ts  + retention.ts  (+ tests)
src/services/  + reviews.ts  + snapshots.ts  (+ tests)   items.ts: setItemStatus starts the review clock
src/data/      queries.ts += dueItems / retentionSummary / focusItems  (+ tests)
src/ui/        routes/ReviewPage.tsx += ReviewQueue + mount sweep
               routes/DashboardPage.tsx += Retention card
               routes/StudyPage.tsx: FocusSection uses focusItems query
src/main.tsx   bootstrap: sweepDue + snapshotToday after ensureSettings
```

---

### Task 1: SRS scheduler (pure domain)

**Files:** Create `src/domain/srs.ts`; Test `src/domain/srs.test.ts`

**Interfaces:**
- Consumes: `addDays`, `dayKey` (domain/time), `Item`/`ItemStatus`/`ReviewState` types.
- Produces (Tasks 3, 6 consume): `SRS_INTERVALS_DAYS` (= [1,3,7,14,30,60,120]), `TOP_RUNG` (= 6), `type ReviewOutcome = 'pass' | 'fail'`, `initialReviewClock(review, now): ReviewState`, `isOverdue(review, now): boolean`, `applyReview(item: Pick<Item,'status'|'review'>, outcome, now): { review: ReviewState; status: ItemStatus }`.

- [ ] **Step 1: Failing tests** — `src/domain/srs.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applyReview, initialReviewClock, isOverdue, SRS_INTERVALS_DAYS, TOP_RUNG } from './srs';
import type { ReviewState } from './types';

const review = (over: Partial<ReviewState> = {}): ReviewState => ({ enabled: true, intervalIndex: 0, ...over });
const now = new Date(2026, 6, 27, 12, 0); // local noon, 2026-07-27

describe('srs', () => {
  it('initialReviewClock starts at rung 0, due tomorrow', () => {
    const r = initialReviewClock(review(), now);
    expect(r.intervalIndex).toBe(0);
    expect(r.dueDate).toBe('2026-07-28');
  });

  it('isOverdue: due today or earlier, only when enabled with a dueDate', () => {
    expect(isOverdue(review({ dueDate: '2026-07-27' }), now)).toBe(true);
    expect(isOverdue(review({ dueDate: '2026-07-28' }), now)).toBe(false);
    expect(isOverdue(review({ enabled: false, dueDate: '2026-07-01' }), now)).toBe(false);
    expect(isOverdue(review(), now)).toBe(false);
  });

  it('pass climbs one rung and schedules the new interval', () => {
    const a = applyReview({ status: 'needs-review', review: review({ intervalIndex: 1 }) }, 'pass', now);
    expect(a.status).toBe('learned');
    expect(a.review.intervalIndex).toBe(2);
    expect(a.review.dueDate).toBe('2026-08-03'); // +7
    expect(a.review.lastOutcome).toBe('pass');
  });

  it('fail resets to rung 0 and forces needs-review', () => {
    const a = applyReview({ status: 'mastered', review: review({ intervalIndex: TOP_RUNG }) }, 'fail', now);
    expect(a.status).toBe('needs-review');
    expect(a.review.intervalIndex).toBe(0);
    expect(a.review.dueDate).toBe('2026-07-28');
  });

  it('passing AT the top rung masters and repeats the top interval', () => {
    const a = applyReview({ status: 'learned', review: review({ intervalIndex: TOP_RUNG }) }, 'pass', now);
    expect(a.status).toBe('mastered');
    expect(a.review.intervalIndex).toBe(TOP_RUNG);
    expect(a.review.dueDate).toBe('2026-11-24'); // +120
  });

  it('the ladder is the documented one', () => {
    expect([...SRS_INTERVALS_DAYS]).toEqual([1, 3, 7, 14, 30, 60, 120]);
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/domain/srs.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** — `src/domain/srs.ts`:

```ts
import { addDays, dayKey } from './time';
import type { Item, ItemStatus, ReviewState } from './types';

export const SRS_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60, 120] as const;
export const TOP_RUNG = SRS_INTERVALS_DAYS.length - 1;

export type ReviewOutcome = 'pass' | 'fail';

export function initialReviewClock(review: ReviewState, now: Date): ReviewState {
  return { ...review, intervalIndex: 0, dueDate: addDays(dayKey(now), SRS_INTERVALS_DAYS[0]), lastOutcome: undefined };
}

export function isOverdue(review: ReviewState, now: Date): boolean {
  return review.enabled && review.dueDate !== undefined && review.dueDate <= dayKey(now);
}

export function applyReview(
  item: Pick<Item, 'status' | 'review'>,
  outcome: ReviewOutcome,
  now: Date
): { review: ReviewState; status: ItemStatus } {
  const today = dayKey(now);
  if (outcome === 'fail') {
    return {
      status: 'needs-review',
      review: { ...item.review, intervalIndex: 0, dueDate: addDays(today, SRS_INTERVALS_DAYS[0]), lastOutcome: 'fail' },
    };
  }
  const atTop = item.review.intervalIndex >= TOP_RUNG;
  const nextIndex = Math.min(item.review.intervalIndex + 1, TOP_RUNG);
  return {
    status: atTop ? 'mastered' : 'learned',
    review: { ...item.review, intervalIndex: nextIndex, dueDate: addDays(today, SRS_INTERVALS_DAYS[nextIndex]), lastOutcome: 'pass' },
  };
}
```

- [ ] **Step 4:** Run the file test → PASS (6). Full suite green.
- [ ] **Step 5:** `git add src/domain && git commit -m "feat(domain): minimal SRS scheduler (fixed ladder, pass/fail)"`

---

### Task 2: Retention metric (pure domain)

**Files:** Create `src/domain/retention.ts`; Test `src/domain/retention.test.ts`

**Interfaces:**
- Produces (Tasks 4, 5 consume): `RetentionCounts { fresh: number; stale: number; ratio: number }`, `retentionOf(items: Pick<Item,'status'|'review'>[]): RetentionCounts`. Tracked = review-enabled items in {learned, needs-review, mastered}; stale = needs-review; `ratio` = fresh/(fresh+stale), **1 when nothing is tracked** (nothing to forget).

- [ ] **Step 1: Failing tests** — `src/domain/retention.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { retentionOf } from './retention';
import type { ItemStatus } from './types';

const item = (status: ItemStatus, enabled = true) => ({ status, review: { enabled, intervalIndex: 0 } });

describe('retention', () => {
  it('counts review-enabled learned/mastered as fresh, needs-review as stale', () => {
    const r = retentionOf([
      item('untouched'), item('in-progress'),
      item('learned'), item('mastered'), item('needs-review'),
      item('needs-review', false), // review disabled: ignored
    ]);
    expect(r).toEqual({ fresh: 2, stale: 1, ratio: 2 / 3 });
  });

  it('is ratio 1 when nothing is tracked yet', () => {
    expect(retentionOf([item('untouched')])).toEqual({ fresh: 0, stale: 0, ratio: 1 });
  });
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3: Implement** — `src/domain/retention.ts`:

```ts
import type { Item, ItemStatus } from './types';

const TRACKED: ReadonlySet<ItemStatus> = new Set(['learned', 'needs-review', 'mastered']);

export interface RetentionCounts {
  fresh: number;
  stale: number;
  ratio: number;
}

export function retentionOf(items: Pick<Item, 'status' | 'review'>[]): RetentionCounts {
  const tracked = items.filter((i) => i.review.enabled && TRACKED.has(i.status));
  const stale = tracked.filter((i) => i.status === 'needs-review').length;
  const fresh = tracked.length - stale;
  return { fresh, stale, ratio: tracked.length === 0 ? 1 : fresh / tracked.length };
}
```

- [ ] **Step 4:** File test PASS (2); full suite green.
- [ ] **Step 5:** `git add src/domain && git commit -m "feat(domain): retention metric"`

---

### Task 3: Review service — clock start, sweep, recordReview

**Files:** Create `src/services/reviews.ts`; Modify `src/services/items.ts` (replace `setItemStatus`); Test `src/services/reviews.test.ts`, `src/services/items.test.ts` (append one test)

**Interfaces:**
- Consumes: `applyReview`/`initialReviewClock`/`isOverdue` (T1), `db`, `ReviewLogEntry` type.
- Produces (Tasks 6–7 consume): `sweepDue(now?): Promise<number>` (flips overdue learned/mastered → needs-review, returns count), `recordReview(itemId, outcome: ReviewOutcome, now?): Promise<void>` (applies scheduler + writes a ReviewLog row, transactionally). Modified `setItemStatus`: entering `'learned'` with `review.enabled` and **no existing dueDate** initializes the clock.

- [ ] **Step 1: Failing tests** — `src/services/reviews.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { recordReview, sweepDue } from './reviews';
import { createArea } from './areas';
import { createItem, setItemStatus } from './items';
import { db } from '../data/db';
import { resetDb } from '../test/resetDb';

async function learnedItem(now: Date) {
  const area = await createArea({ name: 'A', preset: 'conceptual' });
  const item = await createItem({ areaId: area.id, title: 'CAP', kind: 'note' });
  await setItemStatus(item.id, 'learned', now);
  return (await db.items.get(item.id))!;
}

describe('reviews service', () => {
  beforeEach(resetDb);
  const monday = new Date(2026, 6, 27, 12, 0);

  it('sweepDue flips only overdue review-enabled items to needs-review', async () => {
    const item = await learnedItem(monday); // due 2026-07-28
    expect(await sweepDue(new Date(2026, 6, 27, 23, 0))).toBe(0);
    expect(await sweepDue(new Date(2026, 6, 28, 8, 0))).toBe(1);
    expect((await db.items.get(item.id))?.status).toBe('needs-review');
    expect(await sweepDue(new Date(2026, 6, 28, 9, 0))).toBe(0); // already flipped
  });

  it('recordReview pass climbs the ladder and logs; fail resets and logs', async () => {
    const item = await learnedItem(monday);
    await recordReview(item.id, 'pass', new Date(2026, 6, 28));
    let updated = (await db.items.get(item.id))!;
    expect(updated.review.intervalIndex).toBe(1);
    expect(updated.status).toBe('learned');
    await recordReview(item.id, 'fail', new Date(2026, 6, 31));
    updated = (await db.items.get(item.id))!;
    expect(updated.status).toBe('needs-review');
    expect(updated.review.intervalIndex).toBe(0);
    const log = await db.reviewLog.orderBy('at').toArray();
    expect(log.map((l) => l.outcome)).toEqual(['pass', 'fail']);
    expect(log[1].intervalIndexBefore).toBe(1);
    expect(log[1].dueDateAfter).toBe('2026-08-01');
  });
});
```

Append to `src/services/items.test.ts` (inside the describe):

```ts
  it('entering learned starts the review clock once', async () => {
    const area = await createArea({ name: 'A', preset: 'conceptual' });
    const item = await createItem({ areaId: area.id, title: 'X', kind: 'note' });
    await setItemStatus(item.id, 'learned', new Date(2026, 6, 27, 12, 0));
    const first = (await db.items.get(item.id))!;
    expect(first.review.dueDate).toBe('2026-07-28');
    await setItemStatus(item.id, 'in-progress');
    await setItemStatus(item.id, 'learned', new Date(2026, 7, 15, 12, 0));
    expect((await db.items.get(item.id))?.review.dueDate).toBe('2026-07-28'); // clock not restarted
  });
```

- [ ] **Step 2:** Run both files → FAIL.
- [ ] **Step 3: Implement.** In `src/services/items.ts`, add `import { initialReviewClock } from '../domain/srs';` and replace `setItemStatus` with:

```ts
export async function setItemStatus(id: string, status: ItemStatus, now = new Date()): Promise<void> {
  const item = await db.items.get(id);
  if (!item) return;
  const patch: Partial<Item> = { status, updatedAt: now.toISOString() };
  if (status === 'learned' && item.review.enabled && !item.review.dueDate) {
    patch.review = initialReviewClock(item.review, now);
  }
  await db.items.update(id, patch);
}
```

Create `src/services/reviews.ts`:

```ts
import { db } from '../data/db';
import { applyReview, isOverdue, type ReviewOutcome } from '../domain/srs';
import type { ReviewLogEntry } from '../domain/types';

export async function sweepDue(now = new Date()): Promise<number> {
  const candidates = await db.items.where('status').anyOf('learned', 'mastered').toArray();
  const due = candidates.filter((i) => isOverdue(i.review, now));
  const iso = now.toISOString();
  for (const item of due) {
    await db.items.update(item.id, { status: 'needs-review', updatedAt: iso });
  }
  return due.length;
}

export async function recordReview(itemId: string, outcome: ReviewOutcome, now = new Date()): Promise<void> {
  const item = await db.items.get(itemId);
  if (!item || !item.review.enabled) return;
  const before = item.review.intervalIndex;
  const applied = applyReview(item, outcome, now);
  const iso = now.toISOString();
  await db.transaction('rw', [db.items, db.reviewLog], async () => {
    await db.items.update(itemId, { status: applied.status, review: applied.review, updatedAt: iso });
    const entry: ReviewLogEntry = {
      id: crypto.randomUUID(),
      itemId,
      at: iso,
      outcome,
      intervalIndexBefore: before,
      intervalIndexAfter: applied.review.intervalIndex,
      dueDateAfter: applied.review.dueDate!,
    };
    await db.reviewLog.add(entry);
  });
}
```

- [ ] **Step 4:** Both files PASS; full suite green (the pre-existing `setItemStatus` test still passes — it asserts status only).
- [ ] **Step 5:** `git add src/services src/domain && git commit -m "feat(services): review clock, due sweep, recordReview with ReviewLog"`

---

### Task 4: Daily metric snapshots

**Files:** Create `src/services/snapshots.ts`; Test `src/services/snapshots.test.ts`

**Interfaces:**
- Consumes: `coverageOf`, `retentionOf`, `minutesInWeek`, `dayKey`, `db`, `MetricSnapshot` type.
- Produces (Task 7 consumes): `snapshotToday(now?): Promise<boolean>` — writes one global row (`areaId` undefined) plus one row per non-archived area for today's local date; returns false (writes nothing) if today's rows already exist.

- [ ] **Step 1: Failing tests** — `src/services/snapshots.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { snapshotToday } from './snapshots';
import { createArea } from './areas';
import { createItem, setItemStatus } from './items';
import { db } from '../data/db';
import { resetDb } from '../test/resetDb';

describe('snapshots service', () => {
  beforeEach(resetDb);
  const now = new Date(2026, 6, 27, 12, 0);

  it('writes one global and one per-area row per day, idempotently', async () => {
    const area = await createArea({ name: 'A', preset: 'conceptual' });
    const item = await createItem({ areaId: area.id, title: 'X', kind: 'note' });
    await setItemStatus(item.id, 'learned', now);
    expect(await snapshotToday(now)).toBe(true);
    expect(await snapshotToday(new Date(2026, 6, 27, 23, 0))).toBe(false);
    const rows = await db.metricSnapshots.toArray();
    expect(rows).toHaveLength(2);
    const globalRow = rows.find((r) => r.areaId === undefined)!;
    expect(globalRow.date).toBe('2026-07-27');
    expect(globalRow.coverage).toBe(1);
    expect(globalRow.retention).toBe(1);
    const areaRow = rows.find((r) => r.areaId === area.id)!;
    expect(areaRow.coverage).toBe(1);
  });
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3: Implement** — `src/services/snapshots.ts`:

```ts
import { db } from '../data/db';
import { coverageOf } from '../domain/coverage';
import { retentionOf } from '../domain/retention';
import { minutesInWeek } from '../domain/consistency';
import { dayKey } from '../domain/time';
import type { MetricSnapshot } from '../domain/types';

export async function snapshotToday(now = new Date()): Promise<boolean> {
  const date = dayKey(now);
  if ((await db.metricSnapshots.where('date').equals(date).count()) > 0) return false;
  const [areas, items, sessions] = await Promise.all([
    db.areas.filter((a) => !a.archived).toArray(),
    db.items.toArray(),
    db.sessions.toArray(),
  ]);
  const activeItems = items.filter((i) => areas.some((a) => a.id === i.areaId));
  const rows: MetricSnapshot[] = [
    {
      id: crypto.randomUUID(),
      date,
      coverage: coverageOf(activeItems).ratio,
      retention: retentionOf(activeItems).ratio,
      minutes: Math.round(minutesInWeek(sessions, now)),
    },
    ...areas.map((area) => {
      const areaItems = items.filter((i) => i.areaId === area.id);
      return {
        id: crypto.randomUUID(),
        date,
        areaId: area.id,
        coverage: coverageOf(areaItems).ratio,
        retention: retentionOf(areaItems).ratio,
        minutes: Math.round(minutesInWeek(sessions.filter((s) => s.areaId === area.id), now)),
      };
    }),
  ];
  await db.metricSnapshots.bulkAdd(rows);
  return true;
}
```

- [ ] **Step 4:** File test PASS; full suite green.
- [ ] **Step 5:** `git add src/services && git commit -m "feat(services): daily metric snapshots"`

---

### Task 5: Queries — due items, retention summary, archived-safe focus list

**Files:** Modify `src/data/queries.ts` (append three functions + import), `src/ui/routes/StudyPage.tsx` (FocusSection uses the new query); Test `src/data/queries.test.ts` (append two tests)

**Interfaces:**
- Produces (Tasks 6–7 consume): `dueItems(): Promise<Item[]>` (status `needs-review` AND `review.enabled`, oldest-updated first), `interface RetentionSummary { global: RetentionCounts; perArea: { area: Area; counts: RetentionCounts }[] }`, `retentionSummary(): Promise<RetentionSummary>` (global counts over non-archived areas' items), `focusItems(now?): Promise<Item[]>` (current week plan's focus ids, EXCLUDING entries of archived areas — closes the phase-2 final-review minor).
- StudyPage change: `FocusSection` drops its inline `plan`/`ids` wiring and becomes `const items = useLiveQuery(() => focusItems());` with the same render; remove now-unused `currentWeekPlan`/`itemsByIds` from its import line if unused elsewhere in the file.

- [ ] **Step 1: Failing tests** (append inside the queries describe; extend imports with `dueItems, focusItems, retentionSummary` from `./queries`, `archiveArea` already imported, `setItemStatus` already imported, `getOrCreateWeekPlan, updateWeekPlanEntry` already imported):

```ts
  it('dueItems returns review-enabled needs-review items; retentionSummary counts them', async () => {
    const a = await createArea({ name: 'A', preset: 'conceptual' });
    const i1 = await createItem({ areaId: a.id, title: 'due', kind: 'note' });
    const i2 = await createItem({ areaId: a.id, title: 'fresh', kind: 'note' });
    await setItemStatus(i1.id, 'needs-review');
    await setItemStatus(i2.id, 'learned');
    expect((await dueItems()).map((i) => i.title)).toEqual(['due']);
    const r = await retentionSummary();
    expect(r.global).toEqual({ fresh: 1, stale: 1, ratio: 0.5 });
    expect(r.perArea[0].counts.stale).toBe(1);
  });

  it('focusItems excludes archived areas (phase-2 debt)', async () => {
    const keep = await createArea({ name: 'Keep', preset: 'practice' });
    const gone = await createArea({ name: 'Gone', preset: 'practice' });
    const k = await createItem({ areaId: keep.id, title: 'K', kind: 'practice' });
    const g = await createItem({ areaId: gone.id, title: 'G', kind: 'practice' });
    const now = new Date(2026, 6, 24, 12, 0);
    const plan = await getOrCreateWeekPlan(now);
    await updateWeekPlanEntry(plan.id, keep.id, { focusItemIds: [k.id] });
    await updateWeekPlanEntry(plan.id, gone.id, { focusItemIds: [g.id] });
    await archiveArea(gone.id);
    expect((await focusItems(now)).map((i) => i.title)).toEqual(['K']);
  });
```

- [ ] **Step 2:** Run → FAIL. **Step 3: Implement** — append to `src/data/queries.ts` (extend the domain import with `retentionOf, type RetentionCounts` from `../domain/retention`):

```ts
export function dueItems(): Promise<Item[]> {
  return db.items.where('status').equals('needs-review').filter((i) => i.review.enabled).sortBy('updatedAt');
}

export interface RetentionSummary {
  global: RetentionCounts;
  perArea: { area: Area; counts: RetentionCounts }[];
}

export async function retentionSummary(): Promise<RetentionSummary> {
  const [areas, items] = await Promise.all([listAreas(), db.items.toArray()]);
  const activeItems = items.filter((i) => areas.some((a) => a.id === i.areaId));
  return {
    global: retentionOf(activeItems),
    perArea: areas.map((area) => ({ area, counts: retentionOf(items.filter((i) => i.areaId === area.id)) })),
  };
}

export async function focusItems(now = new Date()): Promise<Item[]> {
  const plan = await currentWeekPlan(now);
  if (!plan) return [];
  const areas = await listAreas();
  const ids = plan.entries
    .filter((e) => areas.some((a) => a.id === e.areaId))
    .flatMap((e) => e.focusItemIds);
  return itemsByIds(ids);
}
```

In `src/ui/routes/StudyPage.tsx`, `FocusSection` becomes:

```tsx
function FocusSection() {
  const items = useLiveQuery(() => focusItems());
  if (!items || items.length === 0) return null;
  return (
    /* Card/heading/list/Start-button JSX unchanged from the current file */
  );
}
```

(keep the existing JSX body verbatim; change only the data wiring and the queries import line — `focusItems` in; `currentWeekPlan`/`itemsByIds` out if now unused in this file).

- [ ] **Step 4:** New tests PASS; `npx vitest run src/ui/StudyPage.test.tsx` still green (focus test unaffected — its area is not archived); full suite green.
- [ ] **Step 5:** `git add src/data src/ui && git commit -m "feat(data): due/retention/focus queries; archived-safe focus list"`

---

### Task 6: Review queue UI

**Files:** Modify `src/ui/routes/ReviewPage.tsx`; Test `src/ui/ReviewPage.test.tsx` (append a describe)

**Interfaces:**
- Consumes: `dueItems` (T5), `recordReview` (T3), `sweepDue` (T3), `listAreas`.
- Produces: `ReviewQueue` card rendered between `<BackupReminder />` and the Inbox card, showing each due item (title, keyIdea when present, area name) with two buttons: `Still know it` (pass, aria-label `Still know ${title}`) and `Forgot` (fail, aria-label `Forgot ${title}`). ReviewPage runs `sweepDue()` once on mount. Queue renders null when nothing is due (passive, D-6).

- [ ] **Step 1: Failing tests** (append to `src/ui/ReviewPage.test.tsx`; extend imports with `setItemStatus` from `../services/items` — `createItem` already imported):

```ts
describe('ReviewPage queue', () => {
  beforeEach(resetDb);

  it('sweeps on mount, reviews an overdue item, and it leaves the queue', async () => {
    const user = setupUser();
    const area = await createArea({ name: 'A', preset: 'conceptual' });
    const item = await createItem({ areaId: area.id, title: 'CAP', kind: 'note' });
    await setItemStatus(item.id, 'learned', new Date(2020, 0, 1)); // long overdue
    render(<ReviewPage />);
    await user.click(await screen.findByRole('button', { name: 'Still know CAP' }));
    await waitFor(async () => {
      expect((await db.items.get(item.id))?.status).toBe('learned');
      expect(await db.reviewLog.count()).toBe(1);
    });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Still know CAP' })).not.toBeInTheDocument());
  });
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3: Implement.** In `src/ui/routes/ReviewPage.tsx`: extend imports —

```tsx
import { useEffect } from 'react';
import { dueItems } from '../../data/queries';
import { recordReview, sweepDue } from '../../services/reviews';
```

Add the component (below `StatusSection`):

```tsx
function ReviewQueue() {
  const due = useLiveQuery(dueItems);
  const areas = useLiveQuery(listAreas);
  if (!due || due.length === 0) return null;
  const areaName = (id?: string) => areas?.find((a) => a.id === id)?.name ?? '';
  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">Review queue ({due.length})</h3>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {due.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-2">
              <span>
                {i.title}
                {i.keyIdea ? <span className="text-sm text-muted-foreground"> — {i.keyIdea}</span> : null}
                <span className="text-sm text-muted-foreground"> · {areaName(i.areaId)}</span>
              </span>
              <Button size="sm" aria-label={`Still know ${i.title}`} onClick={() => void recordReview(i.id, 'pass')}>
                Still know it
              </Button>
              <Button size="sm" variant="outline" aria-label={`Forgot ${i.title}`} onClick={() => void recordReview(i.id, 'fail')}>
                Forgot
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
```

In `ReviewPage`, add `useEffect(() => { void sweepDue(); }, []);` as the first statement, and render `<ReviewQueue />` between `<BackupReminder />` and the Inbox card.

- [ ] **Step 4:** ReviewPage tests PASS (all describes); full suite green.
- [ ] **Step 5:** `git add src/ui && git commit -m "feat(ui): review queue with pass/fail self-assessment"`

---

### Task 7: Dashboard retention card + bootstrap wiring

**Files:** Modify `src/ui/routes/DashboardPage.tsx`, `src/main.tsx`; Test `src/ui/DashboardPage.test.tsx` (append one test)

**Interfaces:**
- Consumes: `retentionSummary` (T5), `sweepDue` (T3), `snapshotToday` (T4).
- Produces: a Retention card between Coverage and BackupPanel: global line `${percent}% fresh (${fresh}/${fresh+stale})`, per-area lines only for areas with tracked items, and `No reviewable items yet.` when nothing is tracked globally. `main.tsx` runs `sweepDue()` then `snapshotToday()` after `ensureSettings()`, failures logged but non-fatal (boot must never block).

- [ ] **Step 1: Failing test** (append inside the Dashboard describe; extend imports with `setItemStatus` — `createItem` already imported from T12):

```ts
  it('shows retention with a stale item counted', async () => {
    const a = await createArea({ name: 'A', preset: 'conceptual' });
    const i1 = await createItem({ areaId: a.id, title: 'X', kind: 'note' });
    const i2 = await createItem({ areaId: a.id, title: 'Y', kind: 'note' });
    await setItemStatus(i1.id, 'learned');
    await setItemStatus(i2.id, 'needs-review');
    render(<DashboardPage />);
    expect(await screen.findByText('50% fresh (1/2)')).toBeInTheDocument();
  });
```

- [ ] **Step 2:** Run → FAIL. **Step 3: Implement.** In `DashboardPage.tsx`: extend the queries import with `retentionSummary`; add `const retention = useLiveQuery(() => retentionSummary());`; insert between the Coverage card and `<BackupPanel />`:

```tsx
      <Card>
        <CardHeader>
          <h3 className="font-semibold">Retention</h3>
        </CardHeader>
        <CardContent>
          {retention && retention.global.fresh + retention.global.stale === 0 ? (
            <p>No reviewable items yet.</p>
          ) : retention ? (
            <>
              <p>
                {Math.round(retention.global.ratio * 100)}% fresh ({retention.global.fresh}/
                {retention.global.fresh + retention.global.stale})
              </p>
              <ul>
                {retention.perArea
                  .filter(({ counts }) => counts.fresh + counts.stale > 0)
                  .map(({ area, counts }) => (
                    <li key={area.id}>
                      {area.name}: {counts.fresh}/{counts.fresh + counts.stale} fresh
                    </li>
                  ))}
              </ul>
            </>
          ) : null}
        </CardContent>
      </Card>
```

In `src/main.tsx`, inside the existing `.then` before `createRoot(...)`:

```ts
  try {
    const { sweepDue } = await import('./services/reviews');
    const { snapshotToday } = await import('./services/snapshots');
    await sweepDue();
    await snapshotToday();
  } catch (err) {
    console.error('metrics bootstrap failed', err);
  }
```

(make the `.then` callback `async`; the existing `.catch` for `ensureSettings` stays).

- [ ] **Step 4:** Dashboard tests PASS; full suite green.
- [ ] **Step 5:** `git add src/ui src/main.tsx && git commit -m "feat(ui): retention card; sweep+snapshot on boot"`

---

### Task 8: Wrap-up

**Files:** Modify `README.md` (Status section only)

- [ ] **Step 1:** `npm test` → all green (~85 tests / 24 files). **Step 2:** `npm run build` → green.
- [ ] **Step 3: Manual walkthrough** (controller): mark an item learned in Review → appears nowhere; set its dueDate to yesterday via a dated `setItemStatus`… simpler: create item, `setItemStatus` learned with an old date via console is NOT available — instead verify: learned item shows in Dashboard retention as fresh; reload app → sweep runs; use a fresh item marked learned yesterday is impractical in a live walkthrough, so verify queue via the seeded path: mark learned, confirm retention 100%, then manually set status to needs-review in the Statuses section → queue card appears with pass/fail; "Forgot" keeps it queued (rung reset), "Still know it" clears it and retention returns to 100%; Dashboard shows the Retention card; `metricSnapshots` gains rows on reload (visible via export file).
- [ ] **Step 4:** README `## Status` body becomes:

```markdown
Phase 3 (retention): everything from phases 1–2, plus a minimal spaced-repetition
scheduler (fixed 1/3/7/14/30/60/120-day ladder, pass/fail), automatic needs-review
transitions, a review queue in the Review surface, the retention metric on the
dashboard, and daily metric snapshots. All data lives in this browser's IndexedDB —
**export regularly; the backup file is the only safety net.**
```

- [ ] **Step 5:** `git add README.md && git commit -m "docs: README status for phase 3"`

---

## Self-Review

1. **Spec coverage** — implementation-plan.md Phase 3: SRS scheduler unit-covered (T1); review state on-by-default already true since phase 1 (`review.enabled` per profile/kind); queue with self-assessment prompts (T6); `needs-review` automatic transitions (T3 sweep + fail path); ReviewLog for every outcome (T3); retention metric on dashboard (T7); MetricSnapshot accumulation from boot (T4/T7). D-1 honored (ladder, mastered repeats at 120); D-6 honored (queue Review-only, no badges); §8 minimal-SRS honored; practice items use the same self-assessment in phase 3 — the attempt-driven review upgrade is explicitly phase 4 scope. Phase-2 debt (archived focus items) closed in T5.
2. **Placeholder scan** — clean; every step has full code or exact commands.
3. **Type consistency** — `ReviewOutcome`/`applyReview`/`initialReviewClock`/`isOverdue` (T1) match T3 call sites; `RetentionCounts` (T2) matches `RetentionSummary` (T5) and the T7 render; `dueItems`/`focusItems`/`retentionSummary` (T5) match T6/T7/StudyPage usage; `dueDateAfter` uses the non-null `dueDate` guaranteed by `applyReview`; dayKey-string comparisons are lexicographic-safe.
4. **shadcn/test conventions** — no new Radix selects (buttons only); no polyfill changes; all new tests use explicit dates (no wall-clock flake surface).

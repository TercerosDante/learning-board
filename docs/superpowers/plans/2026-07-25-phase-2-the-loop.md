# Phase 2 — The Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Plan → Study → Review cycle real: global quick-capture with automatic context (UC-8), a Review surface (inbox triage, manual lifecycle changes, backup reminder), a fuller Plan surface (topics, estimates, weekly plan with per-week targets and focus items), and the coverage metric — per `docs/implementation-plan.md` Phase 2.

**Architecture:** Same four layers as phase 1. New pure domain functions (`coverage.ts`, backup-reminder rule), four service modules grow or appear (`items`, `topics`, `captures`, `weekPlan`), reads stay in `data/queries.ts`, and the UI gains one route (Review), three components (QuickCapture, BackupReminder, WeekPlanCard), and modifications to all four existing surfaces.

**Tech Stack:** TypeScript strict, React 18, react-router-dom v6, Dexie 4 + dexie-react-hooks, Vitest + jsdom + fake-indexeddb + Testing Library — plus, new this phase: **Tailwind CSS v4 + shadcn/ui (Radix primitives)** as the component library (user decision, 2026-07-25). Task 0 installs the stack, migrates the phase-1 surfaces, and sets up the Radix test harness; all later UI tasks build with shadcn components.

## Global Constraints

- **NO schema change.** `topics`, `captures`, and `weekPlans` tables (and their indexes `areaId`, `status`, `weekStart`) have existed since schema v1. Dexie stays at `CURRENT_SCHEMA_VERSION` (= 1); the export format is unchanged — ground rules 2 and 4 of `docs/implementation-plan.md` are satisfied with zero migrations. Any task that thinks it needs a schema change is wrong.
- **Friction rule (brief §3/§4):** still no `required` attribute, no blocking dialog, no mandatory field on the Study route. Quick capture is optional and user-invoked everywhere. Task 7 adds an app-level friction test.
- **Organize lives in Plan and Review only** (§4): triage, statuses, topics, estimates, weekly targets never appear on Study.
- **Statuses are manual-only in phase 2.** No automatic transitions — `needs-review` automation is phase 3 (SRS). The status select simply writes what the user picks.
- **Inbox and reminder signals are passive and Review-scoped** (open-decisions D-6, D-14): no nav badges, no toasts. Backup reminder threshold: 14 days, Review surface only.
- Conventions from phase 1 hold: `crypto.randomUUID()` IDs; ISO-8601 timestamps; injectable `now` parameter on every service/domain function; local-midnight days, Monday weeks (`dayKey`/`startOfWeek`); tests import `describe/it/expect` explicitly from `vitest`; commit after every task.
- **Fold-in debt from the phase-1 ledger** (fix where this phase touches the code anyway): scoped form labels on Plan (duplicate-label ambiguity), `<form>`/Enter-to-submit, `weeklyTargetMinutes: 0` rendering as unset, BackupPanel reading Dexie directly (goes through a new `getSettings` query).
- **shadcn/ui conventions (bind every UI task):** primitives come from `@/components/ui/*` (Button, Card, Input, Label, Textarea, Select, Checkbox — installed in Task 0). Radix `SelectItem` must NEVER have `value=""` (it throws) — use the `'none'` sentinel and map it to `''`/`undefined` in the handler. Select triggers get their accessible name via `<Label htmlFor>` + `id` on the trigger, or `aria-label` directly. Radix Checkbox uses `onCheckedChange` (not `onChange`) and pairs with `<Label htmlFor>`.
- **UI test conventions:** any test touching a Radix Select uses `setupUser()` and `pickOption(user, trigger, name)` from `src/test/ui.ts` (Task 0) — `user.selectOptions` does NOT work on Radix selects. Checkbox assertions use `getByRole('checkbox', { name })` + `toBeChecked()` (aria-checked). The jsdom polyfills Radix needs (ResizeObserver, hasPointerCapture, scrollIntoView) live in `src/test/setup.ts` after Task 0 — later tasks must not re-add them.

## File Structure (phase-2 delta)

```
components.json                                            (shadcn config, Task 0)
src/
  components/ui/  button/card/input/label/textarea/select/checkbox .tsx  (shadcn copy-in, Task 0)
  lib/       utils.ts                                      (shadcn cn helper, Task 0)
  domain/    + coverage.ts (+ coverage.test.ts)            backup.ts gains reminder rule
  services/  + topics.ts  + captures.ts  + weekPlan.ts     items.ts gains setItemStatus/updateItem
             (+ topics.test.ts, captures.test.ts, weekPlan.test.ts; items.test.ts grows)
  data/      queries.ts gains getSettings/inboxCaptures/listTopicsForArea/itemsByIds/
             currentWeekPlan/coverageSummary; consistencySummary prefers week-plan targets
  test/      + ui.ts (setupUser/pickOption)                setup.ts gains Radix polyfills (Task 0)
  ui/        + routes/ReviewPage.tsx
             + components/QuickCapture.tsx  + components/BackupReminder.tsx
             + components/WeekPlanCard.tsx
             modified: App.tsx, routes/PlanPage.tsx, routes/StudyPage.tsx,
                       routes/DashboardPage.tsx, components/BackupPanel.tsx,
                       components/SessionBar.tsx, components/StaleSessionBanner.tsx,
                       components/NoteEditor.tsx, index.css, vite.config.ts, tsconfig.json
             (+ QuickCapture.test.tsx, ReviewPage.test.tsx, WeekPlanCard.test.tsx;
                PlanPage/DashboardPage/StudyPage/App tests grow)
```

---

### Task 0: UI stack — Tailwind v4 + shadcn/ui, Radix test harness, phase-1 surface migration

**Files:**
- Modify: `vite.config.ts`, `tsconfig.json`, `src/index.css`, `src/test/setup.ts`, `src/App.tsx`, `src/ui/components/SessionBar.tsx`, `src/ui/components/StaleSessionBanner.tsx`, `src/ui/components/NoteEditor.tsx`, `src/ui/components/BackupPanel.tsx`, `src/ui/routes/StudyPage.tsx`, `src/ui/routes/DashboardPage.tsx`
- Create: `src/test/ui.ts` (plus shadcn-generated: `components.json`, `src/lib/utils.ts`, `src/components/ui/*.tsx`)
- Test: NO new tests. **The exit gate is the existing suite: all 39 tests stay green, build stays green.** `PlanPage.tsx` and its test are deliberately NOT converted — Task 10 replaces both wholesale.

**Interfaces:**
- Consumes: the phase-1 codebase as it exists on this branch.
- Produces: `@/components/ui/{button,card,input,label,textarea,select,checkbox}`; `@/lib/utils` (`cn`); path alias `@/*` → `src/*`; `setupUser()` / `pickOption()` in `src/test/ui.ts`; Radix jsdom polyfills in `src/test/setup.ts`. Every later UI task builds on exactly these.

- [ ] **Step 1: Install and configure Tailwind v4**

```bash
npm install tailwindcss @tailwindcss/vite
```

Replace `vite.config.ts` with:

```ts
/// <reference types="vitest/config" />
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
```

Add to `tsconfig.json` `compilerOptions` (keep everything already there):

```json
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
```

Replace the first two rules of `src/index.css` (the `* { box-sizing… }` reset and the `body { … }` rule — Tailwind preflight covers both) with:

```css
@import "tailwindcss";
```

`PlanPage` still uses `.card` until Task 10, so after the shadcn init in Step 2 rewrites this file, re-check that both the tailwind import/theme AND the legacy `.card` rule survive. The other legacy rules (`.banner`, `.session-bar`, `.app-header`, `textarea.note`, `.error`) lose their last consumers in this task's conversions and are removed here; Task 10 retires `.card`.

- [ ] **Step 2: Initialize shadcn/ui and add the primitives**

```bash
npx shadcn@latest init -y -b neutral
npx shadcn@latest add -y button card input label textarea select checkbox
```

If the CLI prompts despite the flags, accept defaults (style: default; CSS file: `src/index.css`; aliases `@/components` and `@/lib/utils`). Verify `src/components/ui/` now contains the seven components and `src/lib/utils.ts` exists.

- [ ] **Step 3: Radix jsdom polyfills + test helper**

Append to `src/test/setup.ts`:

```ts
// Radix UI needs these APIs that jsdom lacks
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver);
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? (() => {});
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
```

Create `src/test/ui.ts`:

```ts
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

export function setupUser() {
  // Radix overlays toggle pointer-events on <body>; disable the check for stable tests
  return userEvent.setup({ pointerEventsCheck: 0 });
}

export type User = ReturnType<typeof setupUser>;

// Open a shadcn/Radix Select via its trigger, then pick an option (options render in a portal)
export async function pickOption(user: User, trigger: HTMLElement, optionName: string | RegExp) {
  await user.click(trigger);
  await user.click(await screen.findByRole('option', { name: optionName }));
}
```

- [ ] **Step 4: Convert the shell** — replace `src/App.tsx` with:

```tsx
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { DashboardPage } from './ui/routes/DashboardPage';
import { PlanPage } from './ui/routes/PlanPage';
import { StudyPage } from './ui/routes/StudyPage';
import { SessionBar } from './ui/components/SessionBar';
import { StaleSessionBanner } from './ui/components/StaleSessionBanner';

export function App() {
  return (
    <BrowserRouter>
      <header className="flex items-center gap-6 border-b px-4 py-2">
        <nav className="flex gap-4">
          <NavLink to="/" className={({ isActive }) => (isActive ? 'font-bold' : '')}>Dashboard</NavLink>
          <NavLink to="/plan" className={({ isActive }) => (isActive ? 'font-bold' : '')}>Plan</NavLink>
          <NavLink to="/study" className={({ isActive }) => (isActive ? 'font-bold' : '')}>Study</NavLink>
        </nav>
        <SessionBar />
      </header>
      <StaleSessionBanner />
      <main className="mx-auto max-w-4xl space-y-4 p-4">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/study" element={<StudyPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
```

- [ ] **Step 5: Convert SessionBar and StaleSessionBanner** (logic byte-identical — only the JSX below `return` changes)

In `src/ui/components/SessionBar.tsx`, add `import { Button } from '@/components/ui/button';` and replace the returned JSX with:

```tsx
  return (
    <div className="ml-auto flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Studying · {elapsed} min</span>
      <Button size="sm" variant="outline" onClick={() => void stopSession()}>
        Stop
      </Button>
    </div>
  );
```

In `src/ui/components/StaleSessionBanner.tsx`, add `import { Button } from '@/components/ui/button';` and replace the returned JSX with:

```tsx
  return (
    <div className="mx-auto mt-2 max-w-4xl rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm">
      A session from {new Date(stale.startedAt).toLocaleString()} is still running.{' '}
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          void trimSessionToLastTick(stale.id);
          setStale(null);
        }}
      >
        End it at last activity
      </Button>{' '}
      <Button size="sm" variant="ghost" onClick={() => setStale(null)}>
        Keep it running
      </Button>
    </div>
  );
```

- [ ] **Step 6: Convert NoteEditor** (debounce/flush logic byte-identical — only imports and returned JSX change)

In `src/ui/components/NoteEditor.tsx`, add:

```tsx
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
```

and replace the returned JSX (after the `if (!loaded) return null;` line) with:

```tsx
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <Button size="sm" variant="outline" onClick={() => setPreview((p) => !p)}>
        {preview ? 'Edit' : 'Preview'}
      </Button>
      {preview ? (
        <div className="text-sm">
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
      ) : (
        <Textarea
          className="min-h-48 font-mono"
          aria-label="Notes"
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
        />
      )}
    </div>
  );
```

- [ ] **Step 7: Convert StudyPage** — replace `src/ui/routes/StudyPage.tsx` with (logic identical to the current file, including the `Start ${area.name}` aria-label; only presentation changes — DrillRow now uses Radix Checkbox with `onCheckedChange`):

```tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listAreas, listItemsForArea } from '../../data/queries';
import { addManualSession, getActiveSession, startSession } from '../../services/sessions';
import { isDrillDoneToday, setDrillDone } from '../../services/items';
import type { Area, Item } from '../../domain/types';
import { NoteEditor } from '../components/NoteEditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function DrillRow({ item }: { item: Item }) {
  const done = useLiveQuery(() => isDrillDoneToday(item.id), [item.id]);
  return (
    <li className="flex items-center gap-2">
      <Checkbox
        id={`drill-${item.id}`}
        checked={done ?? false}
        onCheckedChange={(checked) => void setDrillDone(item.id, checked === true)}
      />
      <Label htmlFor={`drill-${item.id}`}>{item.title}</Label>
    </li>
  );
}

function StudyAreaSection({ area }: { area: Area }) {
  const items = useLiveQuery(() => listItemsForArea(area.id), [area.id]);
  const [minutes, setMinutes] = useState('');
  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">
          {area.name}{' '}
          <Button
            size="sm"
            variant="outline"
            aria-label={`Start ${area.name}`}
            onClick={() => void startSession({ areaId: area.id })}
          >
            Start
          </Button>
        </h3>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-1">
          {(items ?? []).map((item) =>
            area.profile.minimalMode && item.kind === 'practice' ? (
              <DrillRow key={item.id} item={item} />
            ) : (
              <li key={item.id}>
                {item.title}{' '}
                <Button size="sm" variant="outline" onClick={() => void startSession({ itemId: item.id })}>
                  Start
                </Button>
              </li>
            )
          )}
        </ul>
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground">Log time without the timer</summary>
          <div className="mt-2 flex items-center gap-2">
            <Label htmlFor={`manual-${area.id}`}>Minutes</Label>
            <Input
              id={`manual-${area.id}`}
              type="number"
              className="w-24"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
            <Button
              size="sm"
              onClick={() => {
                const n = Number(minutes);
                if (n > 0) void addManualSession({ areaId: area.id, minutes: n });
                setMinutes('');
              }}
            >
              Add
            </Button>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

export function StudyPage() {
  const areas = useLiveQuery(listAreas);
  const active = useLiveQuery(getActiveSession);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Study</h2>
      {active?.itemId && <NoteEditor itemId={active.itemId} />}
      {(areas ?? []).map((a) => (
        <StudyAreaSection key={a.id} area={a} />
      ))}
    </div>
  );
}
```

- [ ] **Step 8: Convert DashboardPage and BackupPanel** (rendered text nodes must stay byte-identical — the tests assert exact strings)

Replace `src/ui/routes/DashboardPage.tsx` with:

```tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { consistencySummary } from '../../data/queries';
import { BackupPanel } from '../components/BackupPanel';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function DashboardPage() {
  const summary = useLiveQuery(() => consistencySummary());
  if (!summary) return null;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Dashboard</h2>
      <Card>
        <CardHeader>
          <h3 className="font-semibold">Consistency</h3>
        </CardHeader>
        <CardContent>
          <p>
            {summary.minutesThisWeek} / {summary.targetMinutes} min this week
          </p>
          <p>Streak: {summary.streak} day{summary.streak === 1 ? '' : 's'}</p>
          <ul>
            {summary.perArea.map(({ area, minutes }) => (
              <li key={area.id}>
                {area.name}: {minutes} min
                {area.weeklyTargetMinutes ? ` / ${area.weeklyTargetMinutes} min` : ''}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <BackupPanel />
    </div>
  );
}
```

In `src/ui/components/BackupPanel.tsx`: keep all logic (including the try/catch import flow) and replace only the imports/JSX shell —

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
```

```tsx
  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">Backup</h3>
      </CardHeader>
      <CardContent className="space-y-2">
        <p>
          {settings?.lastExportAt
            ? `Last export: ${new Date(settings.lastExportAt).toLocaleString()}`
            : 'Never exported — your data lives only in this browser.'}
        </p>
        <div className="flex items-center gap-3">
          <Button onClick={() => void exportBackup()}>Export backup</Button>
          <label className="text-sm">
            Import backup{' '}
            <input type="file" accept="application/json" onChange={(e) => void onImport(e.target.files?.[0])} />
          </label>
        </div>
        {errors.map((e) => (
          <p key={e} className="text-sm text-red-700">{e}</p>
        ))}
      </CardContent>
    </Card>
  );
```

- [ ] **Step 9: Verify the exit gate**

Run: `npm test`
Expected: PASS — all 39 existing tests green with zero modifications to any test file.

Run: `npm run build`
Expected: green (path alias resolves via tsconfig paths + vite alias).

Run: `npm run dev` briefly — the app should render with the new styling on Dashboard/Study; Plan still looks legacy (expected until Task 10).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(ui): adopt Tailwind v4 + shadcn/ui; migrate shell and phase-1 surfaces"
```

---

### Task 1: Coverage metric and backup-reminder rule (pure domain)

**Files:**
- Create: `src/domain/coverage.ts`
- Modify: `src/domain/backup.ts` (append two exports)
- Test: `src/domain/coverage.test.ts`, `src/domain/backup.test.ts` (append one describe block)

**Interfaces:**
- Consumes: `Item`, `ItemStatus` from `domain/types.ts`.
- Produces: `COVERED_STATUSES`, `CoverageCounts { covered: number; total: number; ratio: number }`, `coverageOf(items: Pick<Item, 'status'>[]): CoverageCounts` (Task 6 consumes); `BACKUP_REMINDER_DAYS` (= 14), `backupReminderDue(lastExportAt: string | undefined, now: Date): boolean` (Task 9 consumes).

- [ ] **Step 1: Write the failing tests**

`src/domain/coverage.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { coverageOf } from './coverage';
import type { ItemStatus } from './types';

describe('coverage', () => {
  it('counts learned, needs-review, and mastered as covered', () => {
    const items: { status: ItemStatus }[] = [
      { status: 'untouched' },
      { status: 'in-progress' },
      { status: 'learned' },
      { status: 'needs-review' },
      { status: 'mastered' },
    ];
    expect(coverageOf(items)).toEqual({ covered: 3, total: 5, ratio: 0.6 });
  });

  it('is 0/0 with ratio 0 for an empty area', () => {
    expect(coverageOf([])).toEqual({ covered: 0, total: 0, ratio: 0 });
  });
});
```

Append to `src/domain/backup.test.ts` (inside the file, as a new top-level describe):

```ts
describe('backupReminderDue', () => {
  const now = new Date(2026, 6, 25, 12, 0);

  it('is due when never exported', () => {
    expect(backupReminderDue(undefined, now)).toBe(true);
  });

  it('is due at/after the threshold and not before', () => {
    const fresh = new Date(2026, 6, 20, 12, 0).toISOString(); // 5 days ago
    const stale = new Date(2026, 6, 11, 12, 0).toISOString(); // exactly 14 days ago
    expect(backupReminderDue(fresh, now)).toBe(false);
    expect(backupReminderDue(stale, now)).toBe(true);
  });
});
```

Also extend that file's import line: `import { BACKUP_FORMAT, CURRENT_SCHEMA_VERSION, TABLE_NAMES, buildBackup, validateBackup, backupReminderDue } from './backup';`

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domain/coverage.test.ts src/domain/backup.test.ts`
Expected: FAIL — cannot resolve `./coverage`; `backupReminderDue` not exported.

- [ ] **Step 3: Implement**

`src/domain/coverage.ts`:

```ts
import type { Item, ItemStatus } from './types';

export const COVERED_STATUSES: ReadonlySet<ItemStatus> = new Set(['learned', 'needs-review', 'mastered']);

export interface CoverageCounts {
  covered: number;
  total: number;
  ratio: number;
}

export function coverageOf(items: Pick<Item, 'status'>[]): CoverageCounts {
  const total = items.length;
  const covered = items.filter((i) => COVERED_STATUSES.has(i.status)).length;
  return { covered, total, ratio: total === 0 ? 0 : covered / total };
}
```

Append to `src/domain/backup.ts`:

```ts
export const BACKUP_REMINDER_DAYS = 14;

export function backupReminderDue(lastExportAt: string | undefined, now: Date): boolean {
  if (!lastExportAt) return true;
  return (now.getTime() - new Date(lastExportAt).getTime()) / 86_400_000 >= BACKUP_REMINDER_DAYS;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/domain/coverage.test.ts src/domain/backup.test.ts`
Expected: PASS (coverage 2 tests; backup file's total grows by 2).

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat(domain): coverage metric and backup-reminder rule"
```

---

### Task 2: Items service — manual status moves and item patches

**Files:**
- Modify: `src/services/items.ts` (append two functions)
- Test: `src/services/items.test.ts` (append two tests)

**Interfaces:**
- Consumes: `db`, `Item`, `ItemStatus`.
- Produces: `setItemStatus(id: string, status: ItemStatus, now?): Promise<void>`, `updateItem(id: string, patch: Partial<Pick<Item, 'title' | 'estimateMinutes' | 'topicId' | 'tags' | 'keyIdea'>>, now?): Promise<void>` — consumed by Tasks 3, 9, 10. Passing `undefined` for a patch field deletes it (Dexie semantics) — Task 10 relies on this to clear estimates/topics.

- [ ] **Step 1: Write the failing tests** (append inside the existing describe in `src/services/items.test.ts`; extend its import line with `setItemStatus, updateItem`)

```ts
  it('setItemStatus applies manual lifecycle moves', async () => {
    const area = await createArea({ name: 'A', preset: 'conceptual' });
    const item = await createItem({ areaId: area.id, title: 'X', kind: 'note' });
    await setItemStatus(item.id, 'learned');
    expect((await db.items.get(item.id))?.status).toBe('learned');
  });

  it('updateItem patches estimate and topic and bumps updatedAt', async () => {
    const area = await createArea({ name: 'A', preset: 'conceptual' });
    const item = await createItem({ areaId: area.id, title: 'X', kind: 'note' }, new Date(2026, 6, 20));
    await updateItem(item.id, { estimateMinutes: 45 }, new Date(2026, 6, 25));
    const updated = await db.items.get(item.id);
    expect(updated?.estimateMinutes).toBe(45);
    expect(updated?.updatedAt).not.toBe(item.updatedAt);
    await updateItem(item.id, { estimateMinutes: undefined });
    expect((await db.items.get(item.id))?.estimateMinutes).toBeUndefined();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/items.test.ts`
Expected: FAIL — `setItemStatus` / `updateItem` not exported.

- [ ] **Step 3: Implement** (append to `src/services/items.ts`; extend its type import with `ItemStatus`)

```ts
export async function setItemStatus(id: string, status: ItemStatus, now = new Date()): Promise<void> {
  await db.items.update(id, { status, updatedAt: now.toISOString() });
}

export async function updateItem(
  id: string,
  patch: Partial<Pick<Item, 'title' | 'estimateMinutes' | 'topicId' | 'tags' | 'keyIdea'>>,
  now = new Date()
): Promise<void> {
  await db.items.update(id, { ...patch, updatedAt: now.toISOString() });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/items.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/items.ts src/services/items.test.ts
git commit -m "feat(services): manual item status moves and item patches"
```

---

### Task 3: Topics service

**Files:**
- Create: `src/services/topics.ts`
- Test: `src/services/topics.test.ts`

**Interfaces:**
- Consumes: `db`, `Topic` type, `updateItem` (tests only).
- Produces: `createTopic(areaId: string, name: string, now?): Promise<Topic>`, `deleteTopic(id: string, now?): Promise<void>` (unsets `topicId` on the topic's items). Topic assignment itself is just `updateItem(id, { topicId })` — no separate function.

- [ ] **Step 1: Write the failing tests**

`src/services/topics.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTopic, deleteTopic } from './topics';
import { createArea } from './areas';
import { createItem, updateItem } from './items';
import { db } from '../data/db';
import { resetDb } from '../test/resetDb';

describe('topics service', () => {
  beforeEach(resetDb);

  it('createTopic appends orderIndex per area and requires a real area', async () => {
    const area = await createArea({ name: 'A', preset: 'conceptual' });
    const t1 = await createTopic(area.id, 'Basics');
    const t2 = await createTopic(area.id, 'Advanced');
    expect([t1.orderIndex, t2.orderIndex]).toEqual([0, 1]);
    expect(t1.areaId).toBe(area.id);
    await expect(createTopic('nope', 'X')).rejects.toThrow('not found');
  });

  it('deleteTopic unsets topicId on its items', async () => {
    const area = await createArea({ name: 'A', preset: 'conceptual' });
    const topic = await createTopic(area.id, 'Basics');
    const item = await createItem({ areaId: area.id, title: 'X', kind: 'note' });
    await updateItem(item.id, { topicId: topic.id });
    await deleteTopic(topic.id);
    expect(await db.topics.count()).toBe(0);
    expect((await db.items.get(item.id))?.topicId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/topics.test.ts`
Expected: FAIL — cannot resolve `./topics`.

- [ ] **Step 3: Implement**

`src/services/topics.ts`:

```ts
import { db } from '../data/db';
import type { Topic } from '../domain/types';

export async function createTopic(areaId: string, name: string, now = new Date()): Promise<Topic> {
  const area = await db.areas.get(areaId);
  if (!area) throw new Error(`area ${areaId} not found`);
  const iso = now.toISOString();
  const count = await db.topics.where('areaId').equals(areaId).count();
  const topic: Topic = {
    id: crypto.randomUUID(),
    areaId,
    name,
    orderIndex: count,
    createdAt: iso,
    updatedAt: iso,
  };
  await db.topics.add(topic);
  return topic;
}

export async function deleteTopic(id: string, now = new Date()): Promise<void> {
  const iso = now.toISOString();
  const orphans = await db.items.where('topicId').equals(id).toArray();
  for (const item of orphans) {
    await db.items.update(item.id, { topicId: undefined, updatedAt: iso });
  }
  await db.topics.delete(id);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/topics.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/topics.ts src/services/topics.test.ts
git commit -m "feat(services): flat topics with orphan-safe delete"
```

---

### Task 4: Captures service — UC-8's frictionless inbox

**Files:**
- Create: `src/services/captures.ts`
- Test: `src/services/captures.test.ts`

**Interfaces:**
- Consumes: `db`, `getActiveSession` (Task 8 of phase 1), `createItem`/`saveNote`/`getNoteText`, `dayKey`, `Capture`/`ItemKind` types.
- Produces: `captureNow(input: { text: string; url?: string; route?: string }, now?): Promise<Capture>` (context stamped automatically from the active session — empty context is legal, open-decisions T-8), `triageToNewItem(captureId, target: { areaId: string; kind: ItemKind; title?: string }, now?)`, `attachToItem(captureId, itemId, now?)` (appends a quoted block to the item's markdown note), `dismissCapture(captureId)`. Consumed by Tasks 7–8.

- [ ] **Step 1: Write the failing tests**

`src/services/captures.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { attachToItem, captureNow, dismissCapture, triageToNewItem } from './captures';
import { createArea } from './areas';
import { createItem, getNoteText, saveNote } from './items';
import { startSession, stopSession } from './sessions';
import { db } from '../data/db';
import { resetDb } from '../test/resetDb';

describe('captures service', () => {
  beforeEach(resetDb);

  it('captureNow stamps context from the active session, or leaves it empty', async () => {
    const area = await createArea({ name: 'A', preset: 'practice' });
    const item = await createItem({ areaId: area.id, title: 'X', kind: 'practice' });
    const session = await startSession({ itemId: item.id });
    const c1 = await captureNow({ text: 'while studying', route: '/study' });
    expect(c1.context).toEqual({ areaId: area.id, itemId: item.id, sessionId: session.id, route: '/study' });
    await stopSession();
    const c2 = await captureNow({ text: 'later thought' });
    expect(c2.context.sessionId).toBeUndefined();
    expect(c2.status).toBe('inbox');
  });

  it('triageToNewItem titles from the text; long text lands in the note', async () => {
    const area = await createArea({ name: 'A', preset: 'conceptual' });
    const longText =
      'An idea that runs much longer than eighty characters so the note must keep the full text safe for later reading';
    const capture = await captureNow({ text: longText });
    await triageToNewItem(capture.id, { areaId: area.id, kind: 'note' });
    const item = (await db.items.toArray())[0];
    expect(item.title).toBe(longText.slice(0, 80));
    expect(await getNoteText(item.id)).toBe(longText);
    const triaged = await db.captures.get(capture.id);
    expect(triaged?.status).toBe('triaged');
    expect(triaged?.triagedToItemId).toBe(item.id);
  });

  it('attachToItem appends a dated quote block to the item note', async () => {
    const area = await createArea({ name: 'A', preset: 'conceptual' });
    const item = await createItem({ areaId: area.id, title: 'X', kind: 'note' });
    await saveNote(item.id, 'existing');
    const capture = await captureNow({ text: 'new insight' }, new Date(2026, 6, 25, 12, 0));
    await attachToItem(capture.id, item.id);
    const note = await getNoteText(item.id);
    expect(note).toContain('existing');
    expect(note).toContain('> [capture 2026-07-25] new insight');
    expect((await db.captures.get(capture.id))?.status).toBe('triaged');
  });

  it('dismissCapture removes it from the inbox without deleting the row', async () => {
    const capture = await captureNow({ text: 'noise' });
    await dismissCapture(capture.id);
    expect((await db.captures.get(capture.id))?.status).toBe('dismissed');
    expect(await db.captures.count()).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/captures.test.ts`
Expected: FAIL — cannot resolve `./captures`.

- [ ] **Step 3: Implement**

`src/services/captures.ts`:

```ts
import { db } from '../data/db';
import { dayKey } from '../domain/time';
import type { Capture, ItemKind } from '../domain/types';
import { createItem, getNoteText, saveNote } from './items';
import { getActiveSession } from './sessions';

const TITLE_MAX = 80;

export async function captureNow(
  input: { text: string; url?: string; route?: string },
  now = new Date()
): Promise<Capture> {
  const active = await getActiveSession();
  const capture: Capture = {
    id: crypto.randomUUID(),
    text: input.text,
    url: input.url,
    at: now.toISOString(),
    context: {
      areaId: active?.areaId,
      itemId: active?.itemId,
      sessionId: active?.id,
      route: input.route,
    },
    status: 'inbox',
  };
  await db.captures.add(capture);
  return capture;
}

export async function triageToNewItem(
  captureId: string,
  target: { areaId: string; kind: ItemKind; title?: string },
  now = new Date()
): Promise<void> {
  const capture = await db.captures.get(captureId);
  if (!capture || capture.status !== 'inbox') return;
  const title = target.title?.trim() || capture.text.slice(0, TITLE_MAX);
  const item = await createItem({ areaId: target.areaId, title, kind: target.kind }, now);
  if (capture.text.length > TITLE_MAX || capture.url) {
    await saveNote(item.id, [capture.text, capture.url].filter(Boolean).join('\n\n'), now);
  }
  await db.captures.update(captureId, { status: 'triaged', triagedToItemId: item.id });
}

export async function attachToItem(captureId: string, itemId: string, now = new Date()): Promise<void> {
  const capture = await db.captures.get(captureId);
  const item = await db.items.get(itemId);
  if (!capture || capture.status !== 'inbox' || !item) return;
  const existing = await getNoteText(itemId);
  const stamp = dayKey(new Date(capture.at));
  const addition = `> [capture ${stamp}] ${capture.text}${capture.url ? `\n> ${capture.url}` : ''}`;
  await saveNote(itemId, existing ? `${existing}\n\n${addition}` : addition, now);
  await db.captures.update(captureId, { status: 'triaged', triagedToItemId: itemId });
}

export async function dismissCapture(captureId: string): Promise<void> {
  await db.captures.update(captureId, { status: 'dismissed' });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/captures.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/captures.ts src/services/captures.test.ts
git commit -m "feat(services): capture inbox with automatic context and triage paths"
```

---

### Task 5: Week plan service

**Files:**
- Create: `src/services/weekPlan.ts`
- Test: `src/services/weekPlan.test.ts`

**Interfaces:**
- Consumes: `db`, `dayKey`/`startOfWeek`, `WeekPlan` type.
- Produces: `weekStartKey(now?): string` (Monday's dayKey), `getOrCreateWeekPlan(now?): Promise<WeekPlan>` (seeds one entry per non-archived area with the area's default target), `updateWeekPlanEntry(weekPlanId, areaId, patch: { targetMinutes?: number; focusItemIds?: string[] }, now?)`. Callers pass ONLY the field they change; passing `targetMinutes: undefined` deliberately clears the override so the area default applies again. Consumed by Tasks 6, 11, 13.

- [ ] **Step 1: Write the failing tests**

`src/services/weekPlan.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getOrCreateWeekPlan, updateWeekPlanEntry, weekStartKey } from './weekPlan';
import { createArea } from './areas';
import { createItem } from './items';
import { db } from '../data/db';
import { resetDb } from '../test/resetDb';

describe('weekPlan service', () => {
  beforeEach(resetDb);
  const friday = new Date(2026, 6, 24, 20, 0);

  it('weekStartKey is the local Monday', () => {
    expect(weekStartKey(friday)).toBe('2026-07-20');
  });

  it('getOrCreateWeekPlan seeds entries from area defaults and is idempotent within a week', async () => {
    const a = await createArea({ name: 'A', preset: 'practice', weeklyTargetMinutes: 120 });
    const plan = await getOrCreateWeekPlan(friday);
    expect(plan.weekStart).toBe('2026-07-20');
    expect(plan.entries).toEqual([{ areaId: a.id, targetMinutes: 120, focusItemIds: [] }]);
    const again = await getOrCreateWeekPlan(new Date(2026, 6, 25, 9, 0));
    expect(again.id).toBe(plan.id);
    expect(await db.weekPlans.count()).toBe(1);
  });

  it('updateWeekPlanEntry overrides target and focus independently', async () => {
    const a = await createArea({ name: 'A', preset: 'practice', weeklyTargetMinutes: 120 });
    const item = await createItem({ areaId: a.id, title: 'X', kind: 'practice' });
    const plan = await getOrCreateWeekPlan(friday);
    await updateWeekPlanEntry(plan.id, a.id, { targetMinutes: 90 });
    await updateWeekPlanEntry(plan.id, a.id, { focusItemIds: [item.id] });
    const updated = await db.weekPlans.get(plan.id);
    expect(updated?.entries).toEqual([{ areaId: a.id, targetMinutes: 90, focusItemIds: [item.id] }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/weekPlan.test.ts`
Expected: FAIL — cannot resolve `./weekPlan`.

- [ ] **Step 3: Implement**

`src/services/weekPlan.ts`:

```ts
import { db } from '../data/db';
import { dayKey, startOfWeek } from '../domain/time';
import type { WeekPlan } from '../domain/types';

export function weekStartKey(now = new Date()): string {
  return dayKey(startOfWeek(now));
}

export async function getOrCreateWeekPlan(now = new Date()): Promise<WeekPlan> {
  const weekStart = weekStartKey(now);
  const existing = await db.weekPlans.where('weekStart').equals(weekStart).first();
  if (existing) return existing;
  const areas = await db.areas.filter((a) => !a.archived).sortBy('orderIndex');
  const iso = now.toISOString();
  const plan: WeekPlan = {
    id: crypto.randomUUID(),
    weekStart,
    entries: areas.map((a) => ({ areaId: a.id, targetMinutes: a.weeklyTargetMinutes, focusItemIds: [] })),
    createdAt: iso,
    updatedAt: iso,
  };
  await db.weekPlans.add(plan);
  return plan;
}

export async function updateWeekPlanEntry(
  weekPlanId: string,
  areaId: string,
  patch: { targetMinutes?: number; focusItemIds?: string[] },
  now = new Date()
): Promise<void> {
  const plan = await db.weekPlans.get(weekPlanId);
  if (!plan) return;
  const entries = plan.entries.some((e) => e.areaId === areaId)
    ? plan.entries.map((e) => (e.areaId === areaId ? { ...e, ...patch } : e))
    : [...plan.entries, { areaId, focusItemIds: [], ...patch }];
  await db.weekPlans.update(weekPlanId, { entries, updatedAt: now.toISOString() });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/weekPlan.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/weekPlan.ts src/services/weekPlan.test.ts
git commit -m "feat(services): weekly plan with per-area targets and focus items"
```

---

### Task 6: Queries — new reads, and consistency prefers week-plan targets

**Files:**
- Modify: `src/data/queries.ts`
- Test: `src/data/queries.test.ts` (append three tests)

**Interfaces:**
- Consumes: `coverageOf` (Task 1), `weekPlans` table (Task 5 writes it), `Capture`/`Topic`/`Settings`/`WeekPlan` types.
- Produces (consumed by Tasks 7–13):
  - `getSettings(): Promise<Settings | undefined>`
  - `inboxCaptures(): Promise<Capture[]>` (status `inbox`, oldest first)
  - `listTopicsForArea(areaId: string): Promise<Topic[]>` (by orderIndex)
  - `itemsByIds(ids: string[]): Promise<Item[]>`
  - `currentWeekPlan(now?): Promise<WeekPlan | null>` (**null**, not undefined, when absent — so `useLiveQuery` can distinguish loading from missing)
  - `interface AreaCoverage extends CoverageCounts { area: Area }`; `coverageSummary(): Promise<AreaCoverage[]>`
  - **Changed:** `ConsistencySummary.perArea` entries gain `targetMinutes?: number`; both the global and per-area targets prefer the current week plan's entry over the area default.

- [ ] **Step 1: Write the failing tests** (append inside the existing describe in `src/data/queries.test.ts`; extend imports with `coverageSummary, currentWeekPlan, inboxCaptures` from `./queries`, `setItemStatus` from `../services/items`, `captureNow, dismissCapture` from `../services/captures`, `getOrCreateWeekPlan, updateWeekPlanEntry` from `../services/weekPlan`)

```ts
  it('consistencySummary prefers current-week-plan targets over area defaults', async () => {
    const a = await createArea({ name: 'A', preset: 'practice', weeklyTargetMinutes: 120 });
    const now = new Date(2026, 6, 24, 21, 0);
    const plan = await getOrCreateWeekPlan(now);
    await updateWeekPlanEntry(plan.id, a.id, { targetMinutes: 90 });
    const s = await consistencySummary(now);
    expect(s.targetMinutes).toBe(90);
    expect(s.perArea[0].targetMinutes).toBe(90);
    expect(await currentWeekPlan(now)).not.toBeNull();
  });

  it('coverageSummary counts covered statuses per area', async () => {
    const a = await createArea({ name: 'A', preset: 'conceptual' });
    const i1 = await createItem({ areaId: a.id, title: '1', kind: 'note' });
    await createItem({ areaId: a.id, title: '2', kind: 'note' });
    await setItemStatus(i1.id, 'learned');
    const cov = await coverageSummary();
    expect(cov).toHaveLength(1);
    expect(cov[0]).toMatchObject({ covered: 1, total: 2, ratio: 0.5 });
  });

  it('inboxCaptures returns only inbox captures, oldest first', async () => {
    await captureNow({ text: 'first' }, new Date(2026, 6, 24, 10, 0));
    await captureNow({ text: 'second' }, new Date(2026, 6, 24, 11, 0));
    const gone = await captureNow({ text: 'gone' }, new Date(2026, 6, 24, 12, 0));
    await dismissCapture(gone.id);
    expect((await inboxCaptures()).map((c) => c.text)).toEqual(['first', 'second']);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/data/queries.test.ts`
Expected: FAIL — new exports missing.

- [ ] **Step 3: Implement** — replace `src/data/queries.ts` with:

```ts
import { db } from './db';
import { activityDays, minutesInWeek, sessionMinutes, streakDays } from '../domain/consistency';
import { coverageOf, type CoverageCounts } from '../domain/coverage';
import { dayKey, startOfWeek } from '../domain/time';
import type { Area, Capture, Item, Settings, Topic, WeekPlan } from '../domain/types';

export function listAreas(): Promise<Area[]> {
  return db.areas.filter((a) => !a.archived).sortBy('orderIndex');
}

export function listItemsForArea(areaId: string): Promise<Item[]> {
  return db.items.where('areaId').equals(areaId).sortBy('createdAt');
}

export function listTopicsForArea(areaId: string): Promise<Topic[]> {
  return db.topics.where('areaId').equals(areaId).sortBy('orderIndex');
}

export function itemsByIds(ids: string[]): Promise<Item[]> {
  return ids.length > 0 ? db.items.where('id').anyOf(ids).toArray() : Promise.resolve([]);
}

export function getSettings(): Promise<Settings | undefined> {
  return db.settings.get('singleton');
}

export function inboxCaptures(): Promise<Capture[]> {
  return db.captures.where('status').equals('inbox').sortBy('at');
}

export async function currentWeekPlan(now = new Date()): Promise<WeekPlan | null> {
  const plan = await db.weekPlans.where('weekStart').equals(dayKey(startOfWeek(now))).first();
  return plan ?? null;
}

export interface AreaCoverage extends CoverageCounts {
  area: Area;
}

export async function coverageSummary(): Promise<AreaCoverage[]> {
  const areas = await listAreas();
  const result: AreaCoverage[] = [];
  for (const area of areas) {
    const items = await db.items.where('areaId').equals(area.id).toArray();
    result.push({ area, ...coverageOf(items) });
  }
  return result;
}

export interface ConsistencySummary {
  minutesThisWeek: number;
  targetMinutes: number;
  streak: number;
  perArea: { area: Area; minutes: number; targetMinutes?: number }[];
}

export async function consistencySummary(now = new Date()): Promise<ConsistencySummary> {
  const [areas, sessions, attempts, plan] = await Promise.all([
    listAreas(),
    db.sessions.toArray(),
    db.attempts.toArray(),
    currentWeekPlan(now),
  ]);
  const targetFor = (area: Area): number | undefined =>
    plan?.entries.find((e) => e.areaId === area.id)?.targetMinutes ?? area.weeklyTargetMinutes;
  const weekStart = startOfWeek(now);
  const weekSessions = sessions.filter((s) => new Date(s.startedAt) >= weekStart && new Date(s.startedAt) <= now);
  const perArea = areas.map((area) => ({
    area,
    minutes: Math.round(
      weekSessions.filter((s) => s.areaId === area.id).reduce((sum, s) => sum + sessionMinutes(s, now), 0)
    ),
    targetMinutes: targetFor(area),
  }));
  return {
    minutesThisWeek: Math.round(minutesInWeek(sessions, now)),
    targetMinutes: areas.reduce((t, a) => t + (targetFor(a) ?? 0), 0),
    streak: streakDays(activityDays(sessions.map((s) => s.startedAt), attempts.map((a) => a.at)), dayKey(now)),
    perArea,
  };
}
```

- [ ] **Step 4: Run tests — the new ones AND the untouched consumers**

Run: `npx vitest run src/data/queries.test.ts src/ui/DashboardPage.test.tsx`
Expected: PASS — the Dashboard test still passes because with no week plan, `targetFor` falls back to area defaults.

- [ ] **Step 5: Commit**

```bash
git add src/data/queries.ts src/data/queries.test.ts
git commit -m "feat(data): inbox/topics/coverage/week-plan queries; targets prefer week plan"
```

---

### Task 7: QuickCapture — global, optional, one keystroke away

**Files:**
- Create: `src/ui/components/QuickCapture.tsx`
- Modify: `src/App.tsx` (add QuickCapture to the header)
- Test: `src/ui/QuickCapture.test.tsx`

**Interfaces:**
- Consumes: `captureNow` (Task 4), `useLocation` (must render inside BrowserRouter).
- Produces: `QuickCapture` — a header toggle button; Ctrl+K opens/closes; Escape closes; Ctrl+Enter or the Save button saves; route context stamped automatically. Zero required attributes.

- [ ] **Step 1: Write the failing tests**

`src/ui/QuickCapture.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { db } from '../data/db';
import { resetDb } from '../test/resetDb';

describe('QuickCapture', () => {
  beforeEach(resetDb);

  it('captures a thought from anywhere, stamping the route', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/plan');
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /Capture/ }));
    await user.type(screen.getByLabelText('Quick capture'), 'stray thought');
    await user.click(screen.getByRole('button', { name: 'Save to inbox' }));
    await waitFor(async () => {
      const captures = await db.captures.toArray();
      expect(captures).toHaveLength(1);
      expect(captures[0].text).toBe('stray thought');
      expect(captures[0].context.route).toBe('/plan');
      expect(captures[0].status).toBe('inbox');
    });
  });

  it('APP-LEVEL FRICTION INVARIANT: /study has no required inputs, capture included (brief §3)', async () => {
    window.history.pushState({}, '', '/study');
    const { container } = render(<App />);
    await screen.findByRole('heading', { name: 'Study' });
    expect(container.querySelectorAll('[required]')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/QuickCapture.test.tsx`
Expected: FAIL — no Capture button in the app.

- [ ] **Step 3: Implement**

`src/ui/components/QuickCapture.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { captureNow } from '../../services/captures';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

export function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const location = useLocation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && e.ctrlKey) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  const save = async () => {
    if (text.trim()) await captureNow({ text: text.trim(), route: location.pathname });
    setText('');
    setOpen(false);
  };

  return (
    <div>
      <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)} title="Quick capture (Ctrl+K)">
        + Capture
      </Button>
      {open && (
        <Card className="fixed right-4 top-14 z-10 w-96 shadow-lg">
          <CardContent className="space-y-2 pt-4">
            <Textarea
              ref={textareaRef}
              aria-label="Quick capture"
              placeholder="Stray thought, link, question… (Ctrl+Enter saves)"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) void save();
              }}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void save()}>
                Save to inbox
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

`src/App.tsx` — add the import and render `<QuickCapture />` between the nav and `<SessionBar />`:

```tsx
import { QuickCapture } from './ui/components/QuickCapture';
```

```tsx
        <nav>
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/plan">Plan</NavLink>
          <NavLink to="/study">Study</NavLink>
        </nav>
        <QuickCapture />
        <SessionBar />
```

(No CSS changes — positioning and sizing are Tailwind classes on the component.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/ui/QuickCapture.test.tsx src/ui/App.test.tsx src/ui/StudyPage.test.tsx`
Expected: PASS — including the pre-existing App and StudyPage tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/QuickCapture.tsx src/App.tsx src/ui/QuickCapture.test.tsx
git commit -m "feat(ui): global quick capture with route context (UC-8)"
```

---

### Task 8: Review surface — route, nav, inbox triage

**Files:**
- Create: `src/ui/routes/ReviewPage.tsx`
- Modify: `src/App.tsx` (Review route + nav link), `src/ui/App.test.tsx` (expect four links)
- Test: `src/ui/ReviewPage.test.tsx`

**Interfaces:**
- Consumes: `inboxCaptures`, `listAreas`, `listItemsForArea` (Task 6); `triageToNewItem`, `attachToItem`, `dismissCapture` (Task 4).
- Produces: `/review` route; `ReviewPage` with an Inbox section (Task 9 adds statuses + reminder to the same file). Each capture row offers: Area+Kind → "New item"; Area+Item → "Attach"; "Dismiss". Row-scoped queries in tests use `within()`.

- [ ] **Step 1: Write the failing tests**

`src/ui/ReviewPage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { ReviewPage } from './routes/ReviewPage';
import { createArea } from '../services/areas';
import { captureNow } from '../services/captures';
import { db } from '../data/db';
import { resetDb } from '../test/resetDb';
import { pickOption, setupUser } from '../test/ui';

describe('ReviewPage inbox', () => {
  beforeEach(resetDb);

  it('promotes a capture to a new item and dismisses another', async () => {
    const user = setupUser();
    await createArea({ name: 'Algorithms', preset: 'practice' });
    await captureNow({ text: 'look into two pointers' });
    await captureNow({ text: 'noise' });
    render(<ReviewPage />);

    const row = (await screen.findByText('look into two pointers')).closest('li')!;
    await pickOption(user, within(row).getByLabelText('Area'), 'Algorithms');
    await user.click(within(row).getByRole('button', { name: 'New item' }));
    await waitFor(async () => {
      expect(await db.items.count()).toBe(1);
      expect((await db.items.toArray())[0].title).toBe('look into two pointers');
    });

    const noiseRow = screen.getByText('noise').closest('li')!;
    await user.click(within(noiseRow).getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(screen.queryByText('noise')).not.toBeInTheDocument());
  });

  it('shows an empty-inbox message when there is nothing to triage', async () => {
    render(<ReviewPage />);
    expect(await screen.findByText(/Inbox empty/)).toBeInTheDocument();
  });
});
```

Update `src/ui/App.test.tsx` — the nav test now expects four links (rename it "renders navigation for the four surfaces" and add):

```tsx
    expect(screen.getByRole('link', { name: 'Review' })).toBeInTheDocument();
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/ReviewPage.test.tsx src/ui/App.test.tsx`
Expected: FAIL — no ReviewPage module, no Review link.

- [ ] **Step 3: Implement**

`src/ui/routes/ReviewPage.tsx`:

```tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { inboxCaptures, listAreas, listItemsForArea } from '../../data/queries';
import { attachToItem, dismissCapture, triageToNewItem } from '../../services/captures';
import type { Area, Capture, Item, ItemKind } from '../../domain/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const KINDS: ItemKind[] = ['note', 'practice', 'project', 'reading'];
const NONE = 'none'; // Radix SelectItem must never have value=""

function TriageRow({ capture, areas }: { capture: Capture; areas: Area[] }) {
  const [areaId, setAreaId] = useState(capture.context.areaId ?? '');
  const [kind, setKind] = useState<ItemKind>('note');
  const [itemId, setItemId] = useState('');
  const items = useLiveQuery(
    () => (areaId ? listItemsForArea(areaId) : Promise.resolve([] as Item[])),
    [areaId]
  );
  return (
    <li className="space-y-2 rounded-lg border p-4">
      <p>{capture.text}</p>
      <p className="text-sm text-muted-foreground">
        {new Date(capture.at).toLocaleString()}
        {capture.context.route ? ` · from ${capture.context.route}` : ''}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={`area-${capture.id}`}>Area</Label>
        <Select
          value={areaId || NONE}
          onValueChange={(v) => {
            setAreaId(v === NONE ? '' : v);
            setItemId('');
          }}
        >
          <SelectTrigger id={`area-${capture.id}`} className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>—</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Label htmlFor={`kind-${capture.id}`}>Kind</Label>
        <Select value={kind} onValueChange={(v) => setKind(v as ItemKind)}>
          <SelectTrigger id={`kind-${capture.id}`} className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((k) => (
              <SelectItem key={k} value={k}>{k}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" disabled={!areaId} onClick={() => void triageToNewItem(capture.id, { areaId, kind })}>
          New item
        </Button>
        <Label htmlFor={`item-${capture.id}`}>Item</Label>
        <Select value={itemId || NONE} onValueChange={(v) => setItemId(v === NONE ? '' : v)}>
          <SelectTrigger id={`item-${capture.id}`} className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>—</SelectItem>
            {(items ?? []).map((i) => (
              <SelectItem key={i.id} value={i.id}>{i.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" disabled={!itemId} onClick={() => void attachToItem(capture.id, itemId)}>
          Attach
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void dismissCapture(capture.id)}>
          Dismiss
        </Button>
      </div>
    </li>
  );
}

export function ReviewPage() {
  const areas = useLiveQuery(listAreas);
  const captures = useLiveQuery(inboxCaptures);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Review</h2>
      <Card>
        <CardHeader>
          <h3 className="font-semibold">Inbox{captures ? ` (${captures.length})` : ''}</h3>
        </CardHeader>
        <CardContent>
          {captures?.length === 0 && <p>Inbox empty — nothing to triage.</p>}
          <ul className="space-y-2">
            {(captures ?? []).map((c) => (
              <TriageRow key={c.id} capture={c} areas={areas ?? []} />
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
```

`src/App.tsx` — add the import, the nav link after Study, and the route:

```tsx
import { ReviewPage } from './ui/routes/ReviewPage';
```

```tsx
          <NavLink to="/review">Review</NavLink>
```

```tsx
          <Route path="/review" element={<ReviewPage />} />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/ui/ReviewPage.test.tsx src/ui/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/routes/ReviewPage.tsx src/App.tsx src/ui/App.test.tsx src/ui/ReviewPage.test.tsx
git commit -m "feat(ui): Review surface with inbox triage"
```

---

### Task 9: Review surface — item statuses and backup reminder

**Files:**
- Create: `src/ui/components/BackupReminder.tsx`
- Modify: `src/ui/routes/ReviewPage.tsx`
- Test: `src/ui/ReviewPage.test.tsx` (append a describe block)

**Interfaces:**
- Consumes: `setItemStatus` (Task 2), `getSettings` (Task 6), `backupReminderDue` (Task 1), `exportBackup`.
- Produces: manual lifecycle select per item (grouped by area) and the D-14 reminder banner, both Review-only.

- [ ] **Step 1: Write the failing tests** (append to `src/ui/ReviewPage.test.tsx`; extend imports with `createItem` from `../services/items`, `ensureSettings` from `../data/db`)

```tsx
describe('ReviewPage statuses and reminder', () => {
  beforeEach(resetDb);

  it('moves an item through the lifecycle manually', async () => {
    const user = setupUser();
    const area = await createArea({ name: 'A', preset: 'conceptual' });
    const item = await createItem({ areaId: area.id, title: 'CAP', kind: 'note' });
    render(<ReviewPage />);
    await pickOption(user, await screen.findByLabelText('Status of CAP'), 'learned');
    await waitFor(async () => expect((await db.items.get(item.id))?.status).toBe('learned'));
  });

  it('shows the backup reminder only when stale', async () => {
    await ensureSettings();
    await db.settings.update('singleton', { lastExportAt: new Date(2026, 0, 1).toISOString() });
    const first = render(<ReviewPage />);
    expect(await first.findByText(/time for a fresh export/)).toBeInTheDocument();
    first.unmount();
    await db.settings.update('singleton', { lastExportAt: new Date().toISOString() });
    render(<ReviewPage />);
    await screen.findByRole('heading', { name: /Inbox/ });
    expect(screen.queryByText(/time for a fresh export/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/ReviewPage.test.tsx`
Expected: FAIL — no status selects, no reminder.

- [ ] **Step 3: Implement**

`src/ui/components/BackupReminder.tsx`:

```tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { backupReminderDue } from '../../domain/backup';
import { getSettings } from '../../data/queries';
import { exportBackup } from '../../services/backupService';
import { Button } from '@/components/ui/button';

export function BackupReminder() {
  const settings = useLiveQuery(getSettings);
  if (settings === undefined) return null; // still loading — ensureSettings guarantees the row exists
  if (!backupReminderDue(settings.lastExportAt, new Date())) return null;
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm">
      {settings.lastExportAt
        ? `Last backup was ${new Date(settings.lastExportAt).toLocaleDateString()} — time for a fresh export.`
        : 'No backup yet — your data lives only in this browser.'}{' '}
      <Button size="sm" variant="outline" onClick={() => void exportBackup()}>
        Export backup
      </Button>
    </div>
  );
}
```

In `src/ui/routes/ReviewPage.tsx`: extend imports —

```tsx
import { setItemStatus } from '../../services/items';
import { BackupReminder } from '../components/BackupReminder';
import type { Area, Capture, Item, ItemKind, ItemStatus } from '../../domain/types';
```

Add below `NONE`:

```tsx
const STATUSES: ItemStatus[] = ['untouched', 'in-progress', 'learned', 'needs-review', 'mastered'];

function StatusSection({ area }: { area: Area }) {
  const items = useLiveQuery(() => listItemsForArea(area.id), [area.id]);
  if (!items || items.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">{area.name}</h3>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-2">
              {i.title}
              <Select value={i.status} onValueChange={(v) => void setItemStatus(i.id, v as ItemStatus)}>
                <SelectTrigger aria-label={`Status of ${i.title}`} className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
```

And in `ReviewPage`'s JSX, render `<BackupReminder />` directly under the `<h2 className="text-xl font-bold">Review</h2>` line, and after the Inbox Card:

```tsx
      <h3 className="text-lg font-semibold">Item statuses</h3>
      {(areas ?? []).map((a) => (
        <StatusSection key={a.id} area={a} />
      ))}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/ui/ReviewPage.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/routes/ReviewPage.tsx src/ui/components/BackupReminder.tsx src/ui/ReviewPage.test.tsx
git commit -m "feat(ui): manual lifecycle moves and backup reminder in Review"
```

---

### Task 10: Plan surface — topics, estimates, scoped labels, real forms

**Files:**
- Modify: `src/ui/routes/PlanPage.tsx` (full replacement below), `src/ui/PlanPage.test.tsx` (full replacement below)

**Interfaces:**
- Consumes: `listTopicsForArea` (Task 6), `createTopic`/`deleteTopic` (Task 3), `updateItem` (Task 2), plus everything PlanPage already used.
- Produces: items grouped by topic with per-item topic select and estimate input; per-area scoped labels (`New item in X`, `Kind for X`, `New topic in X`) fixing the duplicate-label debt; `<form>` submit so Enter works; `weeklyTargetMinutes: 0` renders correctly. **Labels changed here are consumed by this task's updated test file — keep them exactly in sync.**

- [ ] **Step 1: Write the failing test** — replace `src/ui/PlanPage.test.tsx` with:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PlanPage } from './routes/PlanPage';
import { db } from '../data/db';
import { resetDb } from '../test/resetDb';
import { pickOption, setupUser } from '../test/ui';

describe('PlanPage', () => {
  beforeEach(resetDb);

  it('creates an area, a topic, and an item; assigns topic and estimate', async () => {
    const user = setupUser();
    render(<PlanPage />);

    await user.type(screen.getByLabelText('Area name'), 'Algorithms');
    await pickOption(user, screen.getByLabelText('Preset'), 'practice');
    await user.click(screen.getByRole('button', { name: 'Add area' }));
    expect(await screen.findByRole('heading', { name: 'Algorithms' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('New topic in Algorithms'), 'Patterns');
    await user.click(screen.getByRole('button', { name: 'Add topic' }));
    expect(await screen.findByRole('heading', { name: /Patterns/ })).toBeInTheDocument();

    await user.type(screen.getByLabelText('New item in Algorithms'), 'Two pointers');
    await pickOption(user, screen.getByLabelText('Kind for Algorithms'), 'practice');
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    await screen.findByText('Two pointers');

    await pickOption(user, screen.getByLabelText('Topic for Two pointers'), 'Patterns');
    await user.type(screen.getByLabelText('Estimate for Two pointers'), '30');
    await user.tab();

    await waitFor(async () => {
      const item = (await db.items.toArray())[0];
      expect(item.topicId).toBeDefined();
      expect(item.estimateMinutes).toBe(30);
    });
  });

  it('Enter submits the area form', async () => {
    const user = setupUser();
    render(<PlanPage />);
    await user.type(screen.getByLabelText('Area name'), 'Quick{Enter}');
    expect(await screen.findByRole('heading', { name: 'Quick' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/PlanPage.test.tsx`
Expected: FAIL — new labels and topic flow don't exist yet.

- [ ] **Step 3: Implement** — replace `src/ui/routes/PlanPage.tsx` with the code below. Also remove the legacy `.card` block from `src/index.css` — this was its last consumer.

```tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listAreas, listItemsForArea, listTopicsForArea } from '../../data/queries';
import { archiveArea, createArea } from '../../services/areas';
import { createItem, updateItem } from '../../services/items';
import { createTopic, deleteTopic } from '../../services/topics';
import type { Area, AreaPreset, Item, ItemKind, Topic } from '../../domain/types';
import { WeekPlanCard } from '../components/WeekPlanCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PRESETS: AreaPreset[] = ['conceptual', 'practice', 'project', 'time-only', 'minimal'];
const KINDS: ItemKind[] = ['note', 'practice', 'project', 'reading'];
const NONE = 'none'; // Radix SelectItem must never have value=""

function NewAreaForm() {
  const [name, setName] = useState('');
  const [preset, setPreset] = useState<AreaPreset>('conceptual');
  const [target, setTarget] = useState('');
  const submit = async () => {
    if (!name.trim()) return;
    await createArea({
      name: name.trim(),
      preset,
      weeklyTargetMinutes: target ? Number(target) : undefined,
    });
    setName('');
    setTarget('');
  };
  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">New area</h3>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Label htmlFor="area-name">Area name</Label>
          <Input id="area-name" className="w-48" value={name} onChange={(e) => setName(e.target.value)} />
          <Label htmlFor="area-preset">Preset</Label>
          <Select value={preset} onValueChange={(v) => setPreset(v as AreaPreset)}>
            <SelectTrigger id="area-preset" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label htmlFor="area-target">Weekly target (min)</Label>
          <Input
            id="area-target"
            type="number"
            className="w-24"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
          <Button type="submit">Add area</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function EstimateInput({ item }: { item: Item }) {
  const [value, setValue] = useState(item.estimateMinutes?.toString() ?? '');
  return (
    <Input
      type="number"
      className="w-20"
      aria-label={`Estimate for ${item.title}`}
      placeholder="min"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const n = Number(value);
        void updateItem(item.id, { estimateMinutes: value !== '' && n > 0 ? n : undefined });
      }}
    />
  );
}

function ItemRow({ item, topics }: { item: Item; topics: Topic[] }) {
  return (
    <li className="flex flex-wrap items-center gap-2">
      {item.title}{' '}
      <span className="text-sm text-muted-foreground">({item.kind} · {item.status})</span>
      <EstimateInput item={item} />
      <Select
        value={item.topicId ?? NONE}
        onValueChange={(v) => void updateItem(item.id, { topicId: v === NONE ? undefined : v })}
      >
        <SelectTrigger aria-label={`Topic for ${item.title}`} className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>no topic</SelectItem>
          {topics.map((t) => (
            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </li>
  );
}

function AreaSection({ area }: { area: Area }) {
  const items = useLiveQuery(() => listItemsForArea(area.id), [area.id]);
  const topics = useLiveQuery(() => listTopicsForArea(area.id), [area.id]);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ItemKind>('note');
  const [topicName, setTopicName] = useState('');
  const addItem = async () => {
    if (!title.trim()) return;
    await createItem({ areaId: area.id, title: title.trim(), kind });
    setTitle('');
  };
  const addTopic = async () => {
    if (!topicName.trim()) return;
    await createTopic(area.id, topicName.trim());
    setTopicName('');
  };
  const topicList = topics ?? [];
  const itemList = items ?? [];
  const groups: { topic?: Topic; items: Item[] }[] = [
    ...topicList.map((t) => ({ topic: t, items: itemList.filter((i) => i.topicId === t.id) })),
    { items: itemList.filter((i) => !i.topicId || !topicList.some((t) => t.id === i.topicId)) },
  ];
  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">{area.name}</h3>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">
          {area.weeklyTargetMinutes != null ? `Target ${area.weeklyTargetMinutes} min/week · ` : ''}
          <Button size="sm" variant="ghost" onClick={() => void archiveArea(area.id)}>
            Archive
          </Button>
        </p>
        {groups.map((g) => (
          <div key={g.topic?.id ?? 'no-topic'}>
            {g.topic && (
              <h4 className="font-medium">
                {g.topic.name}{' '}
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete topic ${g.topic.name}`}
                  onClick={() => void deleteTopic(g.topic!.id)}
                >
                  ×
                </Button>
              </h4>
            )}
            <ul className="space-y-1">
              {g.items.map((i) => (
                <ItemRow key={i.id} item={i} topics={topicList} />
              ))}
            </ul>
          </div>
        ))}
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addItem();
          }}
        >
          <Label htmlFor={`new-item-${area.id}`}>New item in {area.name}</Label>
          <Input
            id={`new-item-${area.id}`}
            className="w-48"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Label htmlFor={`kind-${area.id}`}>Kind for {area.name}</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as ItemKind)}>
            <SelectTrigger id={`kind-${area.id}`} className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map((k) => (
                <SelectItem key={k} value={k}>{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" size="sm">Add item</Button>
        </form>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addTopic();
          }}
        >
          <Label htmlFor={`new-topic-${area.id}`}>New topic in {area.name}</Label>
          <Input
            id={`new-topic-${area.id}`}
            className="w-48"
            value={topicName}
            onChange={(e) => setTopicName(e.target.value)}
          />
          <Button type="submit" size="sm">Add topic</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function PlanPage() {
  const areas = useLiveQuery(listAreas);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Plan</h2>
      <WeekPlanCard />
      <NewAreaForm />
      {(areas ?? []).map((a) => (
        <AreaSection key={a.id} area={a} />
      ))}
    </div>
  );
}
```

**Note:** `WeekPlanCard` does not exist until Task 11. For THIS task, create it as a stub so the import compiles — `src/ui/components/WeekPlanCard.tsx`:

```tsx
export function WeekPlanCard() {
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/ui/PlanPage.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/routes/PlanPage.tsx src/ui/PlanPage.test.tsx src/ui/components/WeekPlanCard.tsx src/index.css
git commit -m "feat(ui): topics, estimates, and scoped forms on the Plan surface"
```

---

### Task 11: Week plan card

**Files:**
- Modify: `src/ui/components/WeekPlanCard.tsx` (replace the Task 10 stub)
- Test: `src/ui/WeekPlanCard.test.tsx`

**Interfaces:**
- Consumes: `currentWeekPlan`, `listAreas`, `listItemsForArea` (Task 6); `getOrCreateWeekPlan`, `updateWeekPlanEntry` (Task 5); `consistencySummary` (test assertion).
- Produces: the Plan-surface "This week" card — per-area week-target input (blur-commit) and a focus-item checkbox picker. Rendered by PlanPage (wired in Task 10).

- [ ] **Step 1: Write the failing test**

`src/ui/WeekPlanCard.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { WeekPlanCard } from './components/WeekPlanCard';
import { createArea } from '../services/areas';
import { createItem } from '../services/items';
import { consistencySummary } from '../data/queries';
import { resetDb } from '../test/resetDb';
import { setupUser } from '../test/ui';

describe('WeekPlanCard', () => {
  beforeEach(resetDb);

  it('sets up the week, overrides a target, and picks a focus item', async () => {
    const user = setupUser();
    const a = await createArea({ name: 'A', preset: 'practice', weeklyTargetMinutes: 120 });
    await createItem({ areaId: a.id, title: 'Two pointers', kind: 'practice' });
    render(<WeekPlanCard />);

    await user.click(await screen.findByRole('button', { name: 'Set up this week' }));
    const target = await screen.findByLabelText('Week target for A');
    await user.clear(target);
    await user.type(target, '90');
    await user.tab();
    await waitFor(async () => expect((await consistencySummary()).targetMinutes).toBe(90));

    await user.click(screen.getByText(/Focus items/));
    await user.click(screen.getByRole('checkbox', { name: 'Two pointers' }));
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Two pointers' })).toBeChecked()
    ); // liveQuery re-render is async
    expect((await consistencySummary()).targetMinutes).toBe(90); // unchanged by focus toggle
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/WeekPlanCard.test.tsx`
Expected: FAIL — stub renders null.

- [ ] **Step 3: Implement** — replace `src/ui/components/WeekPlanCard.tsx` with:

```tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { currentWeekPlan, listAreas, listItemsForArea } from '../../data/queries';
import { getOrCreateWeekPlan, updateWeekPlanEntry } from '../../services/weekPlan';
import type { Area, WeekPlan } from '../../domain/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function TargetInput({ plan, area }: { plan: WeekPlan; area: Area }) {
  const entry = plan.entries.find((e) => e.areaId === area.id);
  const [value, setValue] = useState(entry?.targetMinutes?.toString() ?? '');
  return (
    <Input
      type="number"
      className="inline-block w-20"
      aria-label={`Week target for ${area.name}`}
      placeholder="min"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const n = Number(value);
        void updateWeekPlanEntry(plan.id, area.id, {
          targetMinutes: value !== '' && n >= 0 ? n : undefined,
        });
      }}
    />
  );
}

function FocusPicker({ plan, area }: { plan: WeekPlan; area: Area }) {
  const items = useLiveQuery(() => listItemsForArea(area.id), [area.id]);
  const entry = plan.entries.find((e) => e.areaId === area.id);
  const focus = entry?.focusItemIds ?? [];
  const toggle = (itemId: string, on: boolean) => {
    const next = on ? [...focus, itemId] : focus.filter((id) => id !== itemId);
    void updateWeekPlanEntry(plan.id, area.id, { focusItemIds: next });
  };
  if (!items || items.length === 0) return null;
  return (
    <details>
      <summary className="cursor-pointer text-sm text-muted-foreground">Focus items ({focus.length})</summary>
      <ul className="mt-1 space-y-1">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-2">
            <Checkbox
              id={`focus-${i.id}`}
              checked={focus.includes(i.id)}
              onCheckedChange={(checked) => toggle(i.id, checked === true)}
            />
            <Label htmlFor={`focus-${i.id}`}>{i.title}</Label>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function WeekPlanCard() {
  const areas = useLiveQuery(listAreas);
  const plan = useLiveQuery(() => currentWeekPlan());
  if (plan === undefined) return null; // loading
  if (plan === null) {
    return (
      <Card>
        <CardHeader>
          <h3 className="font-semibold">This week</h3>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void getOrCreateWeekPlan()}>Set up this week</Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">This week (w/c {plan.weekStart})</h3>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {(areas ?? []).map((area) => (
            <li key={area.id}>
              {area.name}: <TargetInput plan={plan} area={area} /> min
              <FocusPicker plan={plan} area={area} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/ui/WeekPlanCard.test.tsx src/ui/PlanPage.test.tsx`
Expected: PASS — PlanPage still green with the real card in place.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/WeekPlanCard.tsx src/ui/WeekPlanCard.test.tsx
git commit -m "feat(ui): weekly targets and focus items on the Plan surface"
```

---

### Task 12: Dashboard — coverage card, week-aware targets, settings via queries

**Files:**
- Modify: `src/ui/routes/DashboardPage.tsx`, `src/ui/components/BackupPanel.tsx`
- Test: `src/ui/DashboardPage.test.tsx` (append one test)

**Interfaces:**
- Consumes: `coverageSummary`, `getSettings` (Task 6), changed `ConsistencySummary.perArea` (`targetMinutes`).
- Produces: Coverage card on the Dashboard; per-area consistency rows use week-aware `targetMinutes` (also fixes the `0`-renders-as-unset debt); BackupPanel no longer imports `db` (repository-seam debt closed).

- [ ] **Step 1: Write the failing test** (append inside the existing describe in `src/ui/DashboardPage.test.tsx`; extend imports with `createItem, setItemStatus` from `../services/items`)

```tsx
  it('shows per-area coverage', async () => {
    const a = await createArea({ name: 'A', preset: 'conceptual' });
    const i = await createItem({ areaId: a.id, title: 'X', kind: 'note' });
    await createItem({ areaId: a.id, title: 'Y', kind: 'note' });
    await setItemStatus(i.id, 'learned');
    render(<DashboardPage />);
    expect(await screen.findByText('A: 1/2 items (50%)')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/DashboardPage.test.tsx`
Expected: FAIL — no coverage card.

- [ ] **Step 3: Implement**

Replace `src/ui/routes/DashboardPage.tsx` with:

```tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { consistencySummary, coverageSummary } from '../../data/queries';
import { BackupPanel } from '../components/BackupPanel';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function DashboardPage() {
  const summary = useLiveQuery(() => consistencySummary());
  const coverage = useLiveQuery(() => coverageSummary());
  if (!summary) return null;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Dashboard</h2>
      <Card>
        <CardHeader>
          <h3 className="font-semibold">Consistency</h3>
        </CardHeader>
        <CardContent>
          <p>
            {summary.minutesThisWeek} / {summary.targetMinutes} min this week
          </p>
          <p>Streak: {summary.streak} day{summary.streak === 1 ? '' : 's'}</p>
          <ul>
            {summary.perArea.map(({ area, minutes, targetMinutes }) => (
              <li key={area.id}>
                {area.name}: {minutes} min
                {targetMinutes != null ? ` / ${targetMinutes} min` : ''}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h3 className="font-semibold">Coverage</h3>
        </CardHeader>
        <CardContent>
          {coverage && coverage.length === 0 && <p>No areas yet.</p>}
          <ul>
            {(coverage ?? []).map(({ area, covered, total, ratio }) => (
              <li key={area.id}>
                {area.name}: {covered}/{total} items ({Math.round(ratio * 100)}%)
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <BackupPanel />
    </div>
  );
}
```

In `src/ui/components/BackupPanel.tsx`: replace the `db` import and settings query —

```tsx
import { getSettings } from '../../data/queries';
```

(remove `import { db } from '../../data/db';`) and change the live query line to:

```tsx
  const settings = useLiveQuery(getSettings);
```

Everything else in the file stays as-is.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/ui/DashboardPage.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/routes/DashboardPage.tsx src/ui/components/BackupPanel.tsx src/ui/DashboardPage.test.tsx
git commit -m "feat(ui): coverage card and week-aware targets on the dashboard"
```

---

### Task 13: Study — this week's focus, still zero friction

**Files:**
- Modify: `src/ui/routes/StudyPage.tsx`
- Test: `src/ui/StudyPage.test.tsx` (append one test)

**Interfaces:**
- Consumes: `currentWeekPlan`, `itemsByIds` (Task 6), `startSession`.
- Produces: a read-only "This week's focus" card at the top of Study with one-tap Start buttons (`aria-label` \`Start focus ${title}\` to avoid colliding with existing Start buttons). No inputs of any kind — the friction invariant tests must stay green.

- [ ] **Step 1: Write the failing test** (append inside the existing describe in `src/ui/StudyPage.test.tsx`; extend imports with `getOrCreateWeekPlan, updateWeekPlanEntry` from `../services/weekPlan`)

```tsx
  it("shows this week's focus items with one-tap start", async () => {
    const user = userEvent.setup();
    const area = await createArea({ name: 'A', preset: 'practice' });
    const item = await createItem({ areaId: area.id, title: 'Two pointers', kind: 'practice' });
    const plan = await getOrCreateWeekPlan();
    await updateWeekPlanEntry(plan.id, area.id, { focusItemIds: [item.id] });
    render(<StudyPage />);
    expect(await screen.findByRole('heading', { name: "This week's focus" })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start focus Two pointers' }));
    await waitFor(async () => expect((await getActiveSession())?.itemId).toBe(item.id));
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/StudyPage.test.tsx`
Expected: FAIL — no focus section.

- [ ] **Step 3: Implement** — in `src/ui/routes/StudyPage.tsx`, extend the queries import to

```tsx
import { currentWeekPlan, itemsByIds, listAreas, listItemsForArea } from '../../data/queries';
```

add this component above `StudyPage`:

```tsx
function FocusSection() {
  const plan = useLiveQuery(() => currentWeekPlan());
  const ids = plan ? plan.entries.flatMap((e) => e.focusItemIds) : [];
  const items = useLiveQuery(() => itemsByIds(ids), [ids.join('|')]);
  if (!items || items.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">This week's focus</h3>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i.id}>
              {i.title}{' '}
              <Button
                size="sm"
                variant="outline"
                aria-label={`Start focus ${i.title}`}
                onClick={() => void startSession({ itemId: i.id })}
              >
                Start
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
```

and render `<FocusSection />` in `StudyPage` directly under `<h2>Study</h2>` (above the NoteEditor line).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/ui/StudyPage.test.tsx src/ui/QuickCapture.test.tsx`
Expected: PASS — including both friction invariants.

- [ ] **Step 5: Commit**

```bash
git add src/ui/routes/StudyPage.tsx src/ui/StudyPage.test.tsx
git commit -m "feat(ui): weekly focus list on Study with one-tap start"
```

---

### Task 14: Wrap-up — full suite, build, README, walkthrough

**Files:**
- Modify: `README.md` (Status section only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — every phase-1 and phase-2 test green (13 phase-1 files + 7 new files: coverage, topics, captures, weekPlan, QuickCapture, ReviewPage, WeekPlanCard; ≈57 tests).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors.

- [ ] **Step 3: Manual walkthrough** (`npm run dev` — controller/human performs)

1. Ctrl+K anywhere → capture "read about LSM trees" → saves silently.
2. Review: inbox shows it with route context; promote to a new item in an area; dismiss a second capture; move an item to `learned` via the status select.
3. Plan: create a topic, assign the item, set an estimate; "Set up this week", override a target, tick a focus item.
4. Study: focus card lists the item; one-tap Start; **verify nothing on the route demands input**.
5. Dashboard: coverage card shows the learned item counted; consistency target reflects the week override.
6. Review again: backup reminder appears if `lastExportAt` is stale.

- [ ] **Step 4: Update README** — replace the `## Status` section body with:

```markdown
Phase 2 (the loop): everything from phase 1, plus global quick-capture (Ctrl+K) with an
inbox, a Review surface (triage, manual item lifecycle, backup reminder), topics and
estimates and a weekly plan on the Plan surface, and the coverage metric on the dashboard.
All data lives in this browser's IndexedDB — **export regularly; the backup file is the
only safety net.**
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: README status for phase 2"
```

---

## Self-Review (run after writing, before execution)

1. **Spec coverage** — Phase 2 scope from `docs/implementation-plan.md`: global quick-capture with auto-context (T4, T7), inbox (T4, T6, T8), Review surface with triage + manual lifecycle + backup reminder (T8, T9), Plan surface topics/arranging/estimates/WeekPlan (T3, T5, T10, T11), coverage metric on dashboard (T1, T6, T12), statuses live manual-only (T2, T9). Litmus tests: friction invariants re-verified at app level (T7) and per-page (T13); no per-area special case introduced anywhere; **no schema change** (Global Constraints). Open decisions honored: D-5 (intentions, not calendar — T5/T11), D-6/D-14 (passive, Review-only signals — T9), D-11 (one flat topic level — T3), T-8 (empty capture context legal — T4).
2. **Placeholder scan** — no TBDs; every step has full code or exact commands with expected results. The one intentional stub (WeekPlanCard in T10) is explicitly created and replaced in T11.
3. **Type consistency** — `setItemStatus`/`updateItem` (T2) match T9/T10 call sites; `coverageOf`/`CoverageCounts` (T1) match `AreaCoverage` (T6) and the Dashboard render (T12); `currentWeekPlan` returns `WeekPlan | null` (T6) and both `WeekPlanCard` (T11) and `FocusSection` (T13) branch on `undefined`/`null` accordingly; `ConsistencySummary.perArea[].targetMinutes` (T6) matches the T12 destructuring; scoped Plan labels (T10 component) match the T10 test queries exactly.
4. **shadcn consistency** — every Radix Select uses the `'none'` sentinel (never `value=""`); every Select trigger has an accessible name (`Label htmlFor`+`id` or `aria-label`); every Radix Checkbox uses `onCheckedChange` with a `Label htmlFor` pair; every test that opens a Radix Select goes through `pickOption` from `src/test/ui.ts` (T0); no task re-adds the jsdom polyfills T0 installed; Task 0's exit gate (39 phase-1 tests green, zero test-file edits) protects the migration itself.

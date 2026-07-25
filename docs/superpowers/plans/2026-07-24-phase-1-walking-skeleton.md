# Phase 1 — Walking Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The smallest adoptable Learning OS — areas/items with profile presets, start/stop study sessions, consistency metrics (weekly minutes + streak), markdown notes, and full export/import — per `docs/implementation-plan.md` Phase 1.

**Architecture:** Four-layer SPA per `docs/architecture.md`: `domain/` (pure TS: types, time math, consistency metrics, backup format), `data/` (Dexie schema v1 with ALL tables + read queries), `services/` (all writes), `ui/` (React routes: Dashboard, Plan, Study). UI never touches Dexie for writes; reads go through `data/queries.ts` + `useLiveQuery`. The repository seam of architecture.md §1 is realized in phase 1 as `data/queries.ts` (reads) + `services/*` (writes).

**Tech Stack:** TypeScript (strict), Vite, React 18, react-router-dom v6, Dexie 4 + dexie-react-hooks, react-markdown, Vitest + jsdom + fake-indexeddb + Testing Library.

## Global Constraints

- **Friction rule (brief §3/§4):** no `required` attribute, no blocking dialog, no mandatory field anywhere on the Study route. Enforced by test in Task 12.
- **Schema v1 contains ALL tables** (`areas, topics, items, artifacts, sessions, attempts, reviewLog, captures, weekPlans, metricSnapshots, settings`) even though phase 1 UI only uses some (implementation-plan.md ground rule 4).
- **Export before destructive import, always** (brief §9; architecture.md §5).
- IDs: `crypto.randomUUID()`. Timestamps: ISO-8601 strings (`new Date().toISOString()`).
- Day boundary = local midnight; weeks start Monday (open-decisions.md D-3).
- Streak = consecutive local days with ≥1 session **or** attempt (data-model.md §5).
- Node 20+, TypeScript strict mode, React 18+, Dexie 4+.
- Tests import `describe/it/expect` explicitly from `vitest` (no globals).
- Commit after every task (steps included below).

## File Structure (end state of phase 1)

```
package.json  vite.config.ts  tsconfig.json  index.html
src/
  main.tsx  App.tsx  index.css
  domain/    types.ts  time.ts  consistency.ts  backup.ts   (+ *.test.ts)
  data/      db.ts  queries.ts                              (+ *.test.ts)
  services/  areas.ts  items.ts  sessions.ts  backupService.ts  download.ts  (+ *.test.ts)
  ui/        routes/DashboardPage.tsx  routes/PlanPage.tsx  routes/StudyPage.tsx
             components/SessionBar.tsx  components/NoteEditor.tsx  components/BackupPanel.tsx
             (+ StudyPage.test.tsx, App.test.tsx)
  test/      setup.ts  resetDb.ts
```

---

### Task 1: Project scaffold and test harness

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/test/setup.ts`, `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: a running dev app, `npm test` (Vitest, jsdom, fake-indexeddb preloaded), `npm run build`.

- [ ] **Step 1: Init package and install dependencies**

```bash
npm init -y
npm install react react-dom react-router-dom@6 dexie dexie-react-hooks react-markdown
npm install -D typescript vite @vitejs/plugin-react vitest jsdom fake-indexeddb @testing-library/react @testing-library/user-event @testing-library/jest-dom @types/react @types/react-dom
```

- [ ] **Step 2: Write config files**

`package.json` — set these fields (keep the generated deps):

```json
{
  "name": "learning-os",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

`vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Learning OS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

`src/App.tsx` (placeholder; replaced in Task 10):

```tsx
export function App() {
  return <h1>Learning OS</h1>;
}
```

`src/index.css`:

```css
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; color: #222; }
.app-header { display: flex; align-items: center; gap: 1.5rem; padding: 0.5rem 1rem; border-bottom: 1px solid #ddd; }
.app-header nav { display: flex; gap: 1rem; }
.app-header a.active { font-weight: 700; }
main { padding: 1rem; max-width: 60rem; margin: 0 auto; }
.card { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
.session-bar { margin-left: auto; display: flex; gap: 0.5rem; align-items: center; }
.banner { background: #fff7e0; border: 1px solid #e0c060; padding: 0.5rem 1rem; border-radius: 6px; margin-bottom: 1rem; }
.error { color: #b00020; }
textarea.note { width: 100%; min-height: 12rem; font-family: ui-monospace, monospace; }
```

`src/test/setup.ts`:

```ts
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
```

`.gitignore`:

```
node_modules
dist
```

- [ ] **Step 3: Verify build and test runner**

Run: `npm run build`
Expected: succeeds, `dist/` produced.

Run: `npx vitest run --passWithNoTests`
Expected: exits 0, "No test files found".

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS app with Vitest harness"
```

---

### Task 2: Domain types and time utilities

**Files:**
- Create: `src/domain/types.ts`, `src/domain/time.ts`
- Test: `src/domain/time.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: all entity types (used by every later task); `dayKey(d: Date): string`, `addDays(key: string, n: number): string`, `startOfWeek(d: Date): Date`, `minutesBetween(aIso: string, bIso: string): number`.

- [ ] **Step 1: Write entity types**

`src/domain/types.ts` — the conceptual model of `docs/data-model.md` §2, verbatim in TS:

```ts
export type Id = string;

export type AreaPreset = 'conceptual' | 'practice' | 'project' | 'time-only' | 'minimal';

export interface AreaProfile {
  srsDefaultOn: boolean;
  attempts: boolean;
  timedExercises: boolean;
  canvas: boolean;
  video: boolean;
  minimalMode: boolean;
}

export const AREA_PRESETS: Record<AreaPreset, AreaProfile> = {
  conceptual: { srsDefaultOn: true, attempts: false, timedExercises: true, canvas: true, video: true, minimalMode: false },
  practice: { srsDefaultOn: true, attempts: true, timedExercises: true, canvas: false, video: false, minimalMode: false },
  project: { srsDefaultOn: false, attempts: false, timedExercises: false, canvas: true, video: false, minimalMode: false },
  'time-only': { srsDefaultOn: false, attempts: false, timedExercises: false, canvas: false, video: true, minimalMode: false },
  minimal: { srsDefaultOn: false, attempts: true, timedExercises: false, canvas: false, video: false, minimalMode: true },
};

export interface Area {
  id: Id;
  name: string;
  color: string;
  orderIndex: number;
  archived: boolean;
  weeklyTargetMinutes?: number;
  profile: AreaProfile;
  createdAt: string;
  updatedAt: string;
}

export interface Topic {
  id: Id;
  areaId: Id;
  name: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export type ItemKind = 'note' | 'practice' | 'project' | 'reading';
export type ItemStatus = 'untouched' | 'in-progress' | 'learned' | 'needs-review' | 'mastered';

export interface ReviewState {
  enabled: boolean;
  intervalIndex: number;
  dueDate?: string;
  lastOutcome?: 'pass' | 'fail';
}

export interface Item {
  id: Id;
  areaId: Id;
  topicId?: Id;
  title: string;
  kind: ItemKind;
  status: ItemStatus;
  tags: string[];
  estimateMinutes?: number;
  keyIdea?: string;
  exerciseConfig?: { targetMinutes: number };
  externalLinks?: string[];
  review: ReviewState;
  createdAt: string;
  updatedAt: string;
}

export type ArtifactType = 'markdown' | 'canvas' | 'video' | 'link' | 'checklist';

export interface Artifact {
  id: Id;
  itemId: Id;
  attemptId?: Id;
  type: ArtifactType;
  role?: string;
  payload: unknown;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: Id;
  areaId?: Id;
  itemId?: Id;
  startedAt: string;
  endedAt: string | null;
  lastTickAt: string;
  source: 'timer' | 'manual';
  note?: string;
  edited?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AttemptResult = 'pass' | 'passWithHelp' | 'fail';

export interface Attempt {
  id: Id;
  itemId: Id;
  at: string;
  result: AttemptResult;
  durationSec?: number;
  plannedDurationSec?: number;
  note?: string;
  createdAt: string;
}

export interface ReviewLogEntry {
  id: Id;
  itemId: Id;
  at: string;
  outcome: 'pass' | 'fail';
  intervalIndexBefore: number;
  intervalIndexAfter: number;
  dueDateAfter: string;
  sourceAttemptId?: Id;
}

export interface Capture {
  id: Id;
  text: string;
  url?: string;
  at: string;
  context: { areaId?: Id; itemId?: Id; sessionId?: Id; route?: string };
  status: 'inbox' | 'triaged' | 'dismissed';
  triagedToItemId?: Id;
}

export interface WeekPlan {
  id: Id;
  weekStart: string;
  entries: { areaId: Id; targetMinutes?: number; focusItemIds: Id[] }[];
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MetricSnapshot {
  id: Id;
  date: string;
  areaId?: Id;
  coverage: number;
  retention: number;
  minutes: number;
}

export interface Settings {
  id: 'singleton';
  schemaVersion: number;
  lastExportAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Write the failing tests for time utilities**

`src/domain/time.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { dayKey, addDays, startOfWeek, minutesBetween } from './time';

describe('time', () => {
  it('dayKey formats local dates as YYYY-MM-DD', () => {
    expect(dayKey(new Date(2026, 6, 24, 23, 59))).toBe('2026-07-24');
    expect(dayKey(new Date(2026, 0, 3, 0, 0))).toBe('2026-01-03');
  });

  it('addDays does calendar arithmetic across month boundaries', () => {
    expect(addDays('2026-07-24', -1)).toBe('2026-07-23');
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('startOfWeek returns local Monday 00:00', () => {
    const friday = new Date(2026, 6, 24, 20, 15); // Fri 2026-07-24
    const monday = startOfWeek(friday);
    expect(dayKey(monday)).toBe('2026-07-20');
    expect(monday.getHours()).toBe(0);
    // a Monday maps to itself
    expect(dayKey(startOfWeek(new Date(2026, 6, 20, 5, 0)))).toBe('2026-07-20');
  });

  it('minutesBetween is clamped at zero and fractional', () => {
    const a = new Date(2026, 6, 24, 10, 0).toISOString();
    const b = new Date(2026, 6, 24, 10, 45).toISOString();
    expect(minutesBetween(a, b)).toBe(45);
    expect(minutesBetween(b, a)).toBe(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/domain/time.test.ts`
Expected: FAIL — cannot resolve `./time`.

- [ ] **Step 4: Implement time utilities**

`src/domain/time.ts`:

```ts
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

export function startOfWeek(d: Date): Date {
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const mondayOffset = (dt.getDay() + 6) % 7; // Monday=0 … Sunday=6
  dt.setDate(dt.getDate() - mondayOffset);
  return dt;
}

export function minutesBetween(aIso: string, bIso: string): number {
  return Math.max(0, (new Date(bIso).getTime() - new Date(aIso).getTime()) / 60000);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/domain/time.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/domain
git commit -m "feat(domain): entity types and time utilities"
```

---

### Task 3: Consistency metrics (pure)

**Files:**
- Create: `src/domain/consistency.ts`
- Test: `src/domain/consistency.test.ts`

**Interfaces:**
- Consumes: `time.ts` (`dayKey`, `addDays`, `startOfWeek`, `minutesBetween`).
- Produces: `sessionMinutes(s, now)`, `minutesInWeek(sessions, now)`, `activityDays(sessionStarts, attemptTimes)`, `streakDays(days, todayKey)` — consumed by `data/queries.ts` (Task 9).

- [ ] **Step 1: Write the failing tests**

`src/domain/consistency.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sessionMinutes, minutesInWeek, activityDays, streakDays } from './consistency';

const iso = (y: number, mo: number, d: number, h = 12, mi = 0) =>
  new Date(y, mo - 1, d, h, mi).toISOString();

describe('consistency', () => {
  const now = new Date(2026, 6, 24, 20, 0); // Friday evening

  it('sessionMinutes uses now for the still-active session', () => {
    expect(sessionMinutes({ startedAt: iso(2026, 7, 24, 10, 0), endedAt: iso(2026, 7, 24, 10, 30) }, now)).toBe(30);
    expect(sessionMinutes({ startedAt: iso(2026, 7, 24, 19, 40), endedAt: null }, now)).toBe(20);
  });

  it('minutesInWeek counts sessions started this week, including the active one', () => {
    const sessions = [
      { startedAt: iso(2026, 7, 22, 9, 0), endedAt: iso(2026, 7, 22, 9, 30) },  // Wed: 30
      { startedAt: iso(2026, 7, 19, 9, 0), endedAt: iso(2026, 7, 19, 10, 0) },  // previous Sun: excluded
      { startedAt: iso(2026, 7, 24, 19, 40), endedAt: null },                    // active: 20
    ];
    expect(minutesInWeek(sessions, now)).toBe(50);
  });

  it('activityDays unions session and attempt days', () => {
    const days = activityDays([iso(2026, 7, 22)], [iso(2026, 7, 23), iso(2026, 7, 22)]);
    expect(days).toEqual(new Set(['2026-07-22', '2026-07-23']));
  });

  it('streakDays counts back from today, or yesterday if today is empty', () => {
    const days = new Set(['2026-07-22', '2026-07-23', '2026-07-24']);
    expect(streakDays(days, '2026-07-24')).toBe(3);
    // today not yet active: streak not broken yet
    expect(streakDays(new Set(['2026-07-22', '2026-07-23']), '2026-07-24')).toBe(2);
    // gap yesterday: streak is 0
    expect(streakDays(new Set(['2026-07-20']), '2026-07-24')).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domain/consistency.test.ts`
Expected: FAIL — cannot resolve `./consistency`.

- [ ] **Step 3: Implement**

`src/domain/consistency.ts`:

```ts
import { addDays, dayKey, minutesBetween, startOfWeek } from './time';

export interface SessionLike {
  startedAt: string;
  endedAt: string | null;
}

export function sessionMinutes(s: SessionLike, now: Date): number {
  return minutesBetween(s.startedAt, s.endedAt ?? now.toISOString());
}

export function minutesInWeek(sessions: SessionLike[], now: Date): number {
  const weekStart = startOfWeek(now);
  return sessions
    .filter((s) => new Date(s.startedAt) >= weekStart && new Date(s.startedAt) <= now)
    .reduce((sum, s) => sum + sessionMinutes(s, now), 0);
}

export function activityDays(sessionStarts: string[], attemptTimes: string[]): Set<string> {
  const days = new Set<string>();
  for (const t of sessionStarts) days.add(dayKey(new Date(t)));
  for (const t of attemptTimes) days.add(dayKey(new Date(t)));
  return days;
}

export function streakDays(days: Set<string>, todayKey: string): number {
  let cursor = days.has(todayKey) ? todayKey : addDays(todayKey, -1);
  let n = 0;
  while (days.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/domain/consistency.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/consistency.ts src/domain/consistency.test.ts
git commit -m "feat(domain): consistency metrics (weekly minutes, streak)"
```

---

### Task 4: Backup file format (pure)

**Files:**
- Create: `src/domain/backup.ts`
- Test: `src/domain/backup.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `BACKUP_FORMAT`, `CURRENT_SCHEMA_VERSION` (= 1), `TABLE_NAMES`, `TableName`, `BackupFile`, `buildBackup(tables, exportedAt): BackupFile`, `validateBackup(data): {ok:true; backup:BackupFile} | {ok:false; errors:string[]}` — consumed by Task 8. `TABLE_NAMES` must match Dexie table names in Task 5 exactly.

- [ ] **Step 1: Write the failing tests**

`src/domain/backup.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { BACKUP_FORMAT, CURRENT_SCHEMA_VERSION, TABLE_NAMES, buildBackup, validateBackup } from './backup';

function emptyTables() {
  return Object.fromEntries(TABLE_NAMES.map((n) => [n, []])) as Record<(typeof TABLE_NAMES)[number], unknown[]>;
}

describe('backup format', () => {
  it('buildBackup stamps format, version, and time', () => {
    const b = buildBackup(emptyTables(), '2026-07-24T10:00:00.000Z');
    expect(b.format).toBe(BACKUP_FORMAT);
    expect(b.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(b.exportedAt).toBe('2026-07-24T10:00:00.000Z');
  });

  it('round-trips through validateBackup', () => {
    const json = JSON.stringify(buildBackup(emptyTables(), '2026-07-24T10:00:00.000Z'));
    const v = validateBackup(JSON.parse(json));
    expect(v.ok).toBe(true);
  });

  it('rejects wrong format, newer version, and missing tables', () => {
    expect(validateBackup({ format: 'nope' }).ok).toBe(false);
    const newer = { ...buildBackup(emptyTables(), 'x'), schemaVersion: CURRENT_SCHEMA_VERSION + 1 };
    expect(validateBackup(newer).ok).toBe(false);
    const missing = buildBackup(emptyTables(), 'x') as unknown as { tables: Record<string, unknown> };
    delete missing.tables['sessions'];
    const v = validateBackup(missing);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors.join()).toContain('sessions');
  });

  it('rejects non-objects', () => {
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup('hi').ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domain/backup.test.ts`
Expected: FAIL — cannot resolve `./backup`.

- [ ] **Step 3: Implement**

`src/domain/backup.ts`:

```ts
export const BACKUP_FORMAT = 'learning-os-backup';
export const CURRENT_SCHEMA_VERSION = 1;

export const TABLE_NAMES = [
  'areas',
  'topics',
  'items',
  'artifacts',
  'sessions',
  'attempts',
  'reviewLog',
  'captures',
  'weekPlans',
  'metricSnapshots',
  'settings',
] as const;

export type TableName = (typeof TABLE_NAMES)[number];

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  tables: Record<TableName, unknown[]>;
}

export function buildBackup(tables: Record<TableName, unknown[]>, exportedAt: string): BackupFile {
  return { format: BACKUP_FORMAT, schemaVersion: CURRENT_SCHEMA_VERSION, exportedAt, tables };
}

export type ValidateResult = { ok: true; backup: BackupFile } | { ok: false; errors: string[] };

export function validateBackup(data: unknown): ValidateResult {
  if (typeof data !== 'object' || data === null) return { ok: false, errors: ['backup must be a JSON object'] };
  const d = data as Record<string, unknown>;
  const errors: string[] = [];
  if (d.format !== BACKUP_FORMAT) errors.push(`format must be "${BACKUP_FORMAT}"`);
  if (typeof d.schemaVersion !== 'number' || d.schemaVersion < 1) {
    errors.push('schemaVersion must be a number >= 1');
  } else if (d.schemaVersion > CURRENT_SCHEMA_VERSION) {
    errors.push(`backup schemaVersion ${d.schemaVersion} is newer than this app supports (${CURRENT_SCHEMA_VERSION})`);
  }
  const tables = d.tables;
  if (typeof tables !== 'object' || tables === null) {
    errors.push('tables is missing');
  } else {
    for (const name of TABLE_NAMES) {
      if (!Array.isArray((tables as Record<string, unknown>)[name])) errors.push(`tables.${name} must be an array`);
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, backup: d as unknown as BackupFile };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/domain/backup.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/backup.ts src/domain/backup.test.ts
git commit -m "feat(domain): versioned backup file format with validation"
```

---

### Task 5: Dexie database, schema v1, settings bootstrap

**Files:**
- Create: `src/data/db.ts`, `src/test/resetDb.ts`
- Test: `src/data/db.test.ts`

**Interfaces:**
- Consumes: `domain/types.ts`; table names must equal `TABLE_NAMES` (Task 4).
- Produces: `db` (singleton `LearningDb` with typed tables `areas, topics, items, artifacts, sessions, attempts, reviewLog, captures, weekPlans, metricSnapshots, settings`), `ensureSettings(now?): Promise<Settings>`, test helper `resetDb(): Promise<void>` — consumed by all services and queries.

- [ ] **Step 1: Write the failing tests**

`src/data/db.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db, ensureSettings } from './db';
import { TABLE_NAMES } from '../domain/backup';
import { resetDb } from '../test/resetDb';

describe('db', () => {
  beforeEach(resetDb);

  it('has exactly the tables named in the backup format', () => {
    expect(db.tables.map((t) => t.name).sort()).toEqual([...TABLE_NAMES].sort());
  });

  it('ensureSettings creates the singleton once and is idempotent', async () => {
    const a = await ensureSettings(new Date(2026, 6, 24));
    const b = await ensureSettings();
    expect(a.id).toBe('singleton');
    expect(a.schemaVersion).toBe(1);
    expect(b.createdAt).toBe(a.createdAt);
    expect(await db.settings.count()).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/data/db.test.ts`
Expected: FAIL — cannot resolve `./db` / `../test/resetDb`.

- [ ] **Step 3: Implement database and reset helper**

`src/data/db.ts`:

```ts
import Dexie, { type Table } from 'dexie';
import type {
  Area, Topic, Item, Artifact, Session, Attempt,
  ReviewLogEntry, Capture, WeekPlan, MetricSnapshot, Settings,
} from '../domain/types';

export class LearningDb extends Dexie {
  areas!: Table<Area, string>;
  topics!: Table<Topic, string>;
  items!: Table<Item, string>;
  artifacts!: Table<Artifact, string>;
  sessions!: Table<Session, string>;
  attempts!: Table<Attempt, string>;
  reviewLog!: Table<ReviewLogEntry, string>;
  captures!: Table<Capture, string>;
  weekPlans!: Table<WeekPlan, string>;
  metricSnapshots!: Table<MetricSnapshot, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('learning-os');
    this.version(1).stores({
      areas: 'id, orderIndex, archived',
      topics: 'id, areaId',
      items: 'id, areaId, topicId, status, kind, *tags',
      artifacts: 'id, itemId, attemptId, type',
      sessions: 'id, startedAt, areaId, itemId',
      attempts: 'id, itemId, at',
      reviewLog: 'id, itemId, at',
      captures: 'id, at, status',
      weekPlans: 'id, weekStart',
      metricSnapshots: 'id, date, areaId',
      settings: 'id',
    });
  }
}

export const db = new LearningDb();

export async function ensureSettings(now = new Date()): Promise<Settings> {
  const existing = await db.settings.get('singleton');
  if (existing) return existing;
  const iso = now.toISOString();
  const settings: Settings = { id: 'singleton', schemaVersion: 1, createdAt: iso, updatedAt: iso };
  await db.settings.put(settings);
  return settings;
}
```

Note: `endedAt` is deliberately **not** indexed — IndexedDB cannot index `null`; the active session is found by a filter scan (fine at personal scale).

`src/test/resetDb.ts`:

```ts
import { db } from '../data/db';

export async function resetDb(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/data/db.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/db.ts src/data/db.test.ts src/test/resetDb.ts
git commit -m "feat(data): Dexie schema v1 with all tables and settings bootstrap"
```

---

### Task 6: Areas service

**Files:**
- Create: `src/services/areas.ts`
- Test: `src/services/areas.test.ts`

**Interfaces:**
- Consumes: `db` (Task 5), `AREA_PRESETS`, types (Task 2).
- Produces: `createArea(input: {name: string; preset: AreaPreset; color?: string; weeklyTargetMinutes?: number}, now?): Promise<Area>`, `updateArea(id: string, patch: Partial<Pick<Area,'name'|'color'|'weeklyTargetMinutes'|'profile'|'orderIndex'>>, now?): Promise<void>`, `archiveArea(id: string, now?): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

`src/services/areas.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createArea, archiveArea } from './areas';
import { db } from '../data/db';
import { AREA_PRESETS } from '../domain/types';
import { resetDb } from '../test/resetDb';

describe('areas service', () => {
  beforeEach(resetDb);

  it('createArea copies the preset profile and appends orderIndex', async () => {
    const a = await createArea({ name: 'Algorithms', preset: 'practice', weeklyTargetMinutes: 180 });
    const b = await createArea({ name: 'Coding drills', preset: 'minimal' });
    expect(a.profile).toEqual(AREA_PRESETS.practice);
    expect(a.weeklyTargetMinutes).toBe(180);
    expect(a.archived).toBe(false);
    expect(b.profile.minimalMode).toBe(true);
    expect(b.orderIndex).toBeGreaterThan(a.orderIndex);
  });

  it('archiveArea hides the area without deleting rows', async () => {
    const a = await createArea({ name: 'X', preset: 'conceptual' });
    await archiveArea(a.id);
    expect((await db.areas.get(a.id))?.archived).toBe(true);
    expect(await db.areas.count()).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/areas.test.ts`
Expected: FAIL — cannot resolve `./areas`.

- [ ] **Step 3: Implement**

`src/services/areas.ts`:

```ts
import { db } from '../data/db';
import { AREA_PRESETS, type Area, type AreaPreset } from '../domain/types';

export async function createArea(
  input: { name: string; preset: AreaPreset; color?: string; weeklyTargetMinutes?: number },
  now = new Date()
): Promise<Area> {
  const iso = now.toISOString();
  const count = await db.areas.count();
  const area: Area = {
    id: crypto.randomUUID(),
    name: input.name,
    color: input.color ?? '#4a6fa5',
    orderIndex: count,
    archived: false,
    weeklyTargetMinutes: input.weeklyTargetMinutes,
    profile: { ...AREA_PRESETS[input.preset] },
    createdAt: iso,
    updatedAt: iso,
  };
  await db.areas.add(area);
  return area;
}

export async function updateArea(
  id: string,
  patch: Partial<Pick<Area, 'name' | 'color' | 'weeklyTargetMinutes' | 'profile' | 'orderIndex'>>,
  now = new Date()
): Promise<void> {
  await db.areas.update(id, { ...patch, updatedAt: now.toISOString() });
}

export async function archiveArea(id: string, now = new Date()): Promise<void> {
  await db.areas.update(id, { archived: true, updatedAt: now.toISOString() });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/areas.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/areas.ts src/services/areas.test.ts
git commit -m "feat(services): area creation with profile presets"
```

---

### Task 7: Items service — creation, notes, drill done-tick

**Files:**
- Create: `src/services/items.ts`
- Test: `src/services/items.test.ts`

**Interfaces:**
- Consumes: `db`, `dayKey` (Task 2), areas rows (Task 6).
- Produces: `createItem(input: {areaId: string; title: string; kind: ItemKind}, now?): Promise<Item>`, `touchItem(id: string, now?): Promise<void>` (untouched → in-progress; called by sessions service Task 8), `saveNote(itemId: string, text: string, now?): Promise<void>`, `getNoteText(itemId: string): Promise<string>`, `setDrillDone(itemId: string, done: boolean, now?): Promise<void>`, `isDrillDoneToday(itemId: string, now?): Promise<boolean>`.

- [ ] **Step 1: Write the failing tests**

`src/services/items.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createArea } from './areas';
import { createItem, touchItem, saveNote, getNoteText, setDrillDone, isDrillDoneToday } from './items';
import { db } from '../data/db';
import { resetDb } from '../test/resetDb';

describe('items service', () => {
  beforeEach(resetDb);

  it('review.enabled follows kind default gated by the area profile (data-model.md §2)', async () => {
    const conceptual = await createArea({ name: 'SysDesign', preset: 'conceptual' }); // srsDefaultOn: true
    const minimal = await createArea({ name: 'Drills', preset: 'minimal' }); // srsDefaultOn: false
    expect((await createItem({ areaId: conceptual.id, title: 'CAP', kind: 'note' })).review.enabled).toBe(true);
    expect((await createItem({ areaId: conceptual.id, title: 'Build X', kind: 'project' })).review.enabled).toBe(false);
    expect((await createItem({ areaId: minimal.id, title: 'Kata', kind: 'practice' })).review.enabled).toBe(false);
  });

  it('touchItem promotes untouched to in-progress exactly once', async () => {
    const area = await createArea({ name: 'A', preset: 'practice' });
    const item = await createItem({ areaId: area.id, title: 'Two pointers', kind: 'practice' });
    expect(item.status).toBe('untouched');
    await touchItem(item.id);
    expect((await db.items.get(item.id))?.status).toBe('in-progress');
    await db.items.update(item.id, { status: 'learned' });
    await touchItem(item.id); // must not demote
    expect((await db.items.get(item.id))?.status).toBe('learned');
  });

  it('saveNote upserts a single markdown artifact', async () => {
    const area = await createArea({ name: 'A', preset: 'conceptual' });
    const item = await createItem({ areaId: area.id, title: 'N', kind: 'note' });
    await saveNote(item.id, 'first');
    await saveNote(item.id, 'second');
    expect(await getNoteText(item.id)).toBe('second');
    expect(await db.artifacts.where('itemId').equals(item.id).count()).toBe(1);
  });

  it('setDrillDone logs a pass attempt and is reversible today (UC-5)', async () => {
    const area = await createArea({ name: 'Drills', preset: 'minimal' });
    const item = await createItem({ areaId: area.id, title: 'Daily kata', kind: 'practice' });
    const now = new Date(2026, 6, 24, 21, 0);
    await setDrillDone(item.id, true, now);
    expect(await isDrillDoneToday(item.id, now)).toBe(true);
    expect((await db.attempts.toArray())[0]?.result).toBe('pass');
    expect((await db.items.get(item.id))?.status).toBe('in-progress');
    await setDrillDone(item.id, false, now);
    expect(await isDrillDoneToday(item.id, now)).toBe(false);
    expect(await db.attempts.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/items.test.ts`
Expected: FAIL — cannot resolve `./items`.

- [ ] **Step 3: Implement**

`src/services/items.ts`:

```ts
import { db } from '../data/db';
import { dayKey } from '../domain/time';
import type { Item, ItemKind } from '../domain/types';

const KIND_REVIEW_DEFAULT: Record<ItemKind, boolean> = {
  note: true,
  practice: true,
  reading: true,
  project: false,
};

export async function createItem(
  input: { areaId: string; title: string; kind: ItemKind },
  now = new Date()
): Promise<Item> {
  const area = await db.areas.get(input.areaId);
  if (!area) throw new Error(`area ${input.areaId} not found`);
  const iso = now.toISOString();
  const item: Item = {
    id: crypto.randomUUID(),
    areaId: area.id,
    title: input.title,
    kind: input.kind,
    status: 'untouched',
    tags: [],
    review: { enabled: area.profile.srsDefaultOn && KIND_REVIEW_DEFAULT[input.kind], intervalIndex: 0 },
    createdAt: iso,
    updatedAt: iso,
  };
  await db.items.add(item);
  return item;
}

export async function touchItem(id: string, now = new Date()): Promise<void> {
  const item = await db.items.get(id);
  if (item?.status === 'untouched') {
    await db.items.update(id, { status: 'in-progress', updatedAt: now.toISOString() });
  }
}

async function markdownArtifact(itemId: string) {
  return db.artifacts.where('itemId').equals(itemId).filter((a) => a.type === 'markdown').first();
}

export async function saveNote(itemId: string, text: string, now = new Date()): Promise<void> {
  const iso = now.toISOString();
  const existing = await markdownArtifact(itemId);
  if (existing) {
    await db.artifacts.update(existing.id, { payload: { text }, updatedAt: iso });
  } else {
    await db.artifacts.add({
      id: crypto.randomUUID(),
      itemId,
      type: 'markdown',
      payload: { text },
      orderIndex: 0,
      createdAt: iso,
      updatedAt: iso,
    });
  }
}

export async function getNoteText(itemId: string): Promise<string> {
  const a = await markdownArtifact(itemId);
  return a ? (a.payload as { text: string }).text : '';
}

async function todaysAttempts(itemId: string, now: Date) {
  const today = dayKey(now);
  return db.attempts.where('itemId').equals(itemId).filter((a) => dayKey(new Date(a.at)) === today).toArray();
}

export async function setDrillDone(itemId: string, done: boolean, now = new Date()): Promise<void> {
  const existing = await todaysAttempts(itemId, now);
  if (done && existing.length === 0) {
    const iso = now.toISOString();
    await db.attempts.add({ id: crypto.randomUUID(), itemId, at: iso, result: 'pass', createdAt: iso });
    await touchItem(itemId, now);
  }
  if (!done) {
    for (const a of existing) await db.attempts.delete(a.id);
  }
}

export async function isDrillDoneToday(itemId: string, now = new Date()): Promise<boolean> {
  return (await todaysAttempts(itemId, now)).length > 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/items.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/items.ts src/services/items.test.ts
git commit -m "feat(services): items with markdown notes and UC-5 drill done-tick"
```

---

### Task 8: Sessions service — the only required action

**Files:**
- Create: `src/services/sessions.ts`
- Test: `src/services/sessions.test.ts`

**Interfaces:**
- Consumes: `db`, `touchItem` (Task 7), `minutesBetween` (Task 2).
- Produces: `STALE_GAP_MINUTES` (= 10), `getActiveSession(): Promise<Session | undefined>`, `startSession(target: {areaId?: string; itemId?: string}, now?): Promise<Session>`, `stopSession(now?): Promise<void>`, `tickSession(now?): Promise<void>`, `addManualSession(input: {areaId?: string; itemId?: string; minutes: number; note?: string}, now?): Promise<Session>`, `getStaleActiveSession(now?): Promise<Session | null>`, `trimSessionToLastTick(id: string, now?): Promise<void>` — consumed by SessionBar (Task 10) and StudyPage (Task 12).

- [ ] **Step 1: Write the failing tests**

`src/services/sessions.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createArea } from './areas';
import { createItem } from './items';
import {
  getActiveSession, startSession, stopSession, tickSession,
  addManualSession, getStaleActiveSession, trimSessionToLastTick,
} from './sessions';
import { db } from '../data/db';
import { resetDb } from '../test/resetDb';

describe('sessions service', () => {
  beforeEach(resetDb);

  it('startSession from an item resolves areaId and touches the item', async () => {
    const area = await createArea({ name: 'A', preset: 'practice' });
    const item = await createItem({ areaId: area.id, title: 'I', kind: 'practice' });
    const s = await startSession({ itemId: item.id });
    expect(s.areaId).toBe(area.id);
    expect(s.endedAt).toBeNull();
    expect((await db.items.get(item.id))?.status).toBe('in-progress');
    expect((await getActiveSession())?.id).toBe(s.id);
  });

  it('starting a new session auto-stops the previous one (never two active)', async () => {
    const area = await createArea({ name: 'A', preset: 'conceptual' });
    const s1 = await startSession({ areaId: area.id }, new Date(2026, 6, 24, 10, 0));
    const s2 = await startSession({ areaId: area.id }, new Date(2026, 6, 24, 10, 30));
    expect((await db.sessions.get(s1.id))?.endedAt).not.toBeNull();
    expect((await getActiveSession())?.id).toBe(s2.id);
    await stopSession(new Date(2026, 6, 24, 11, 0));
    expect(await getActiveSession()).toBeUndefined();
  });

  it('manual sessions are backdated by duration and never active', async () => {
    const area = await createArea({ name: 'A', preset: 'time-only' });
    const now = new Date(2026, 6, 24, 22, 0);
    const s = await addManualSession({ areaId: area.id, minutes: 40 }, now);
    expect(s.source).toBe('manual');
    expect(s.endedAt).toBe(now.toISOString());
    expect(new Date(s.startedAt).getTime()).toBe(now.getTime() - 40 * 60000);
    expect(await getActiveSession()).toBeUndefined();
  });

  it('stale detection and one-tap trim (open-decisions.md D-4)', async () => {
    const area = await createArea({ name: 'A', preset: 'conceptual' });
    const s = await startSession({ areaId: area.id }, new Date(2026, 6, 24, 10, 0));
    await tickSession(new Date(2026, 6, 24, 10, 5));
    expect(await getStaleActiveSession(new Date(2026, 6, 24, 10, 12))).toBeNull(); // 7 min gap: fine
    const stale = await getStaleActiveSession(new Date(2026, 6, 24, 11, 0)); // 55 min gap
    expect(stale?.id).toBe(s.id);
    await trimSessionToLastTick(s.id);
    const trimmed = await db.sessions.get(s.id);
    expect(trimmed?.endedAt).toBe(new Date(2026, 6, 24, 10, 5).toISOString());
    expect(trimmed?.edited).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/sessions.test.ts`
Expected: FAIL — cannot resolve `./sessions`.

- [ ] **Step 3: Implement**

`src/services/sessions.ts`:

```ts
import { db } from '../data/db';
import { minutesBetween } from '../domain/time';
import type { Session } from '../domain/types';
import { touchItem } from './items';

export const STALE_GAP_MINUTES = 10;

export async function getActiveSession(): Promise<Session | undefined> {
  return db.sessions.filter((s) => s.endedAt === null).first();
}

export async function startSession(
  target: { areaId?: string; itemId?: string },
  now = new Date()
): Promise<Session> {
  await stopSession(now); // switching is frictionless: no need to stop first
  let areaId = target.areaId;
  if (target.itemId) {
    const item = await db.items.get(target.itemId);
    if (!item) throw new Error(`item ${target.itemId} not found`);
    areaId = item.areaId;
    await touchItem(item.id, now);
  }
  const iso = now.toISOString();
  const session: Session = {
    id: crypto.randomUUID(),
    areaId,
    itemId: target.itemId,
    startedAt: iso,
    endedAt: null,
    lastTickAt: iso,
    source: 'timer',
    createdAt: iso,
    updatedAt: iso,
  };
  await db.sessions.add(session);
  return session;
}

export async function stopSession(now = new Date()): Promise<void> {
  const active = await getActiveSession();
  if (!active) return;
  const iso = now.toISOString();
  await db.sessions.update(active.id, { endedAt: iso, lastTickAt: iso, updatedAt: iso });
}

export async function tickSession(now = new Date()): Promise<void> {
  const active = await getActiveSession();
  if (!active) return;
  await db.sessions.update(active.id, { lastTickAt: now.toISOString() });
}

export async function addManualSession(
  input: { areaId?: string; itemId?: string; minutes: number; note?: string },
  now = new Date()
): Promise<Session> {
  const iso = now.toISOString();
  const startedAt = new Date(now.getTime() - input.minutes * 60000).toISOString();
  const session: Session = {
    id: crypto.randomUUID(),
    areaId: input.areaId,
    itemId: input.itemId,
    startedAt,
    endedAt: iso,
    lastTickAt: iso,
    source: 'manual',
    note: input.note,
    createdAt: iso,
    updatedAt: iso,
  };
  await db.sessions.add(session);
  if (input.itemId) await touchItem(input.itemId, now);
  return session;
}

export async function getStaleActiveSession(now = new Date()): Promise<Session | null> {
  const active = await getActiveSession();
  if (!active) return null;
  return minutesBetween(active.lastTickAt, now.toISOString()) > STALE_GAP_MINUTES ? active : null;
}

export async function trimSessionToLastTick(id: string, now = new Date()): Promise<void> {
  const s = await db.sessions.get(id);
  if (!s || s.endedAt !== null) return;
  await db.sessions.update(id, { endedAt: s.lastTickAt, edited: true, updatedAt: now.toISOString() });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/sessions.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/sessions.ts src/services/sessions.test.ts
git commit -m "feat(services): session engine with auto-switch, manual entry, stale recovery"
```

---

### Task 9: Backup service and read queries

**Files:**
- Create: `src/services/download.ts`, `src/services/backupService.ts`, `src/data/queries.ts`
- Test: `src/services/backupService.test.ts`, `src/data/queries.test.ts`

**Interfaces:**
- Consumes: `db`, `ensureSettings`, backup format (Task 4), consistency functions (Task 3), `dayKey`.
- Produces:
  - `download.ts`: `type SaveFn = (fileName: string, json: string) => void`, `downloadJson: SaveFn` (Blob + anchor click).
  - `backupService.ts`: `exportBackup(save?: SaveFn, now?): Promise<void>` (sets `settings.lastExportAt`), `importBackup(json: string, save?: SaveFn, now?): Promise<{ok: true} | {ok: false; errors: string[]}>` (validates → **exports current state first** → transactionally clears and loads all tables).
  - `queries.ts`: `listAreas(): Promise<Area[]>` (non-archived, by orderIndex), `listItemsForArea(areaId: string): Promise<Item[]>`, `type ConsistencySummary = { minutesThisWeek: number; targetMinutes: number; streak: number; perArea: { area: Area; minutes: number }[] }`, `consistencySummary(now?): Promise<ConsistencySummary>` — consumed by all UI tasks.

- [ ] **Step 1: Write the failing tests**

`src/services/backupService.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { exportBackup, importBackup } from './backupService';
import { createArea } from './areas';
import { createItem } from './items';
import { db, ensureSettings } from '../data/db';
import { resetDb } from '../test/resetDb';

describe('backup service', () => {
  beforeEach(async () => {
    await resetDb();
    await ensureSettings();
  });

  it('exportBackup saves a valid file and stamps lastExportAt', async () => {
    await createArea({ name: 'A', preset: 'conceptual' });
    const saved: string[] = [];
    await exportBackup((name, json) => saved.push(name, json), new Date(2026, 6, 24));
    expect(saved[0]).toBe('learning-os-backup-2026-07-24.json');
    const parsed = JSON.parse(saved[1]);
    expect(parsed.format).toBe('learning-os-backup');
    expect(parsed.tables.areas).toHaveLength(1);
    expect((await db.settings.get('singleton'))?.lastExportAt).toBeDefined();
  });

  it('importBackup replaces all data, auto-exporting current state first', async () => {
    const area = await createArea({ name: 'Old', preset: 'practice' });
    await createItem({ areaId: area.id, title: 'Old item', kind: 'practice' });
    // build a backup representing a DIFFERENT state
    const foreign: string[] = [];
    await exportBackup((_n, json) => foreign.push(json));
    await createArea({ name: 'Extra (will vanish on import)', preset: 'minimal' });

    const safety: string[] = [];
    const result = await importBackup(foreign[0], (name) => safety.push(name));
    expect(result.ok).toBe(true);
    expect(safety).toHaveLength(1); // pre-import auto-backup happened
    expect(await db.areas.count()).toBe(1); // 'Extra' gone, snapshot restored
    expect(await db.items.count()).toBe(1);
  });

  it('importBackup rejects invalid files without touching data', async () => {
    await createArea({ name: 'Keep me', preset: 'conceptual' });
    const before = await db.areas.count();
    expect((await importBackup('not json', () => {})).ok).toBe(false);
    expect((await importBackup('{"format":"wrong"}', () => {})).ok).toBe(false);
    expect(await db.areas.count()).toBe(before);
  });
});
```

`src/data/queries.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { consistencySummary, listAreas } from './queries';
import { createArea, archiveArea } from '../services/areas';
import { createItem, setDrillDone } from '../services/items';
import { addManualSession } from '../services/sessions';
import { resetDb } from '../test/resetDb';

describe('queries', () => {
  beforeEach(resetDb);

  it('listAreas hides archived areas', async () => {
    await createArea({ name: 'Visible', preset: 'conceptual' });
    const hidden = await createArea({ name: 'Hidden', preset: 'minimal' });
    await archiveArea(hidden.id);
    expect((await listAreas()).map((a) => a.name)).toEqual(['Visible']);
  });

  it('consistencySummary aggregates week minutes, targets, per-area, and streak', async () => {
    const a = await createArea({ name: 'A', preset: 'practice', weeklyTargetMinutes: 120 });
    const b = await createArea({ name: 'B', preset: 'minimal' });
    const now = new Date(2026, 6, 24, 21, 0); // Friday
    await addManualSession({ areaId: a.id, minutes: 30 }, new Date(2026, 6, 24, 20, 0));
    await addManualSession({ areaId: a.id, minutes: 45 }, new Date(2026, 6, 23, 20, 0)); // Thursday
    const drill = await createItem({ areaId: b.id, title: 'Kata', kind: 'practice' });
    await setDrillDone(drill.id, true, new Date(2026, 6, 22, 9, 0)); // Wednesday attempt keeps streak alive
    const s = await consistencySummary(now);
    expect(s.minutesThisWeek).toBe(75);
    expect(s.targetMinutes).toBe(120);
    expect(s.perArea.find((p) => p.area.id === a.id)?.minutes).toBe(75);
    expect(s.streak).toBe(3); // Wed(attempt) + Thu + Fri
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/backupService.test.ts src/data/queries.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/services/download.ts`:

```ts
export type SaveFn = (fileName: string, json: string) => void;

export const downloadJson: SaveFn = (fileName, json) => {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};
```

`src/services/backupService.ts`:

```ts
import { db } from '../data/db';
import { buildBackup, validateBackup, TABLE_NAMES, type BackupFile } from '../domain/backup';
import { dayKey } from '../domain/time';
import { downloadJson, type SaveFn } from './download';

export async function exportBackup(save: SaveFn = downloadJson, now = new Date()): Promise<void> {
  const tables = {} as BackupFile['tables'];
  for (const name of TABLE_NAMES) {
    tables[name] = await db.table(name).toArray();
  }
  const backup = buildBackup(tables, now.toISOString());
  save(`learning-os-backup-${dayKey(now)}.json`, JSON.stringify(backup, null, 2));
  await db.settings.update('singleton', { lastExportAt: now.toISOString(), updatedAt: now.toISOString() });
}

export type ImportResult = { ok: true } | { ok: false; errors: string[] };

export async function importBackup(json: string, save: SaveFn = downloadJson, now = new Date()): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, errors: ['file is not valid JSON'] };
  }
  const v = validateBackup(parsed);
  if (!v.ok) return v;
  await exportBackup(save, now); // §9 safety net: current state saved before replace
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear();
    for (const name of TABLE_NAMES) {
      const rows = v.backup.tables[name];
      if (rows.length > 0) await db.table(name).bulkAdd(rows as never[]);
    }
  });
  return { ok: true };
}
```

`src/data/queries.ts`:

```ts
import { db } from './db';
import { activityDays, minutesInWeek, sessionMinutes, streakDays } from '../domain/consistency';
import { dayKey, startOfWeek } from '../domain/time';
import type { Area, Item } from '../domain/types';

export function listAreas(): Promise<Area[]> {
  return db.areas.filter((a) => !a.archived).sortBy('orderIndex');
}

export function listItemsForArea(areaId: string): Promise<Item[]> {
  return db.items.where('areaId').equals(areaId).sortBy('createdAt');
}

export interface ConsistencySummary {
  minutesThisWeek: number;
  targetMinutes: number;
  streak: number;
  perArea: { area: Area; minutes: number }[];
}

export async function consistencySummary(now = new Date()): Promise<ConsistencySummary> {
  const [areas, sessions, attempts] = await Promise.all([
    listAreas(),
    db.sessions.toArray(),
    db.attempts.toArray(),
  ]);
  const weekStart = startOfWeek(now);
  const weekSessions = sessions.filter((s) => new Date(s.startedAt) >= weekStart && new Date(s.startedAt) <= now);
  const perArea = areas.map((area) => ({
    area,
    minutes: Math.round(
      weekSessions.filter((s) => s.areaId === area.id).reduce((sum, s) => sum + sessionMinutes(s, now), 0)
    ),
  }));
  return {
    minutesThisWeek: Math.round(minutesInWeek(sessions, now)),
    targetMinutes: areas.reduce((t, a) => t + (a.weeklyTargetMinutes ?? 0), 0),
    streak: streakDays(activityDays(sessions.map((s) => s.startedAt), attempts.map((a) => a.at)), dayKey(now)),
    perArea,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/backupService.test.ts src/data/queries.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — all tests green.

- [ ] **Step 6: Commit**

```bash
git add src/services/download.ts src/services/backupService.ts src/services/backupService.test.ts src/data/queries.ts src/data/queries.test.ts
git commit -m "feat: export/import with pre-import safety backup; consistency queries"
```

---

### Task 10: App shell — router, nav, SessionBar

**Files:**
- Modify: `src/App.tsx`, `src/main.tsx`
- Create: `src/ui/components/SessionBar.tsx`, `src/ui/routes/DashboardPage.tsx` (stub), `src/ui/routes/PlanPage.tsx` (stub), `src/ui/routes/StudyPage.tsx` (stub)
- Test: `src/ui/App.test.tsx`

**Interfaces:**
- Consumes: `getActiveSession`, `stopSession`, `tickSession` (Task 8), `minutesBetween` (Task 2), `ensureSettings` (Task 5).
- Produces: `App` with routes `/` → DashboardPage, `/plan` → PlanPage, `/study` → StudyPage; `SessionBar` visible on every route. Page stubs are replaced in Tasks 11–13.

- [ ] **Step 1: Write the failing test**

`src/ui/App.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../App';
import { resetDb } from '../test/resetDb';

describe('App shell', () => {
  beforeEach(resetDb);

  it('renders navigation for the three phase-1 surfaces', async () => {
    render(<App />);
    expect(await screen.findByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Plan' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Study' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/App.test.tsx`
Expected: FAIL — no nav links in placeholder App.

- [ ] **Step 3: Implement shell**

Page stubs (each replaced by its own task):

```tsx
// src/ui/routes/DashboardPage.tsx
export function DashboardPage() {
  return <h2>Dashboard</h2>;
}
```

```tsx
// src/ui/routes/PlanPage.tsx
export function PlanPage() {
  return <h2>Plan</h2>;
}
```

```tsx
// src/ui/routes/StudyPage.tsx
export function StudyPage() {
  return <h2>Study</h2>;
}
```

`src/ui/components/SessionBar.tsx`:

```tsx
import { useEffect, useReducer } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getActiveSession, stopSession, tickSession } from '../../services/sessions';
import { minutesBetween } from '../../domain/time';

export function SessionBar() {
  const active = useLiveQuery(getActiveSession);
  const [, forceRender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!active) return;
    const display = setInterval(forceRender, 1000);
    const tick = setInterval(() => void tickSession(), 60_000);
    return () => {
      clearInterval(display);
      clearInterval(tick);
    };
  }, [active?.id]);

  if (!active) return null;
  const elapsed = Math.floor(minutesBetween(active.startedAt, new Date().toISOString()));
  return (
    <div className="session-bar">
      <span>Studying · {elapsed} min</span>
      <button onClick={() => void stopSession()}>Stop</button>
    </div>
  );
}
```

`src/App.tsx` (replace placeholder):

```tsx
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { DashboardPage } from './ui/routes/DashboardPage';
import { PlanPage } from './ui/routes/PlanPage';
import { StudyPage } from './ui/routes/StudyPage';
import { SessionBar } from './ui/components/SessionBar';

export function App() {
  return (
    <BrowserRouter>
      <header className="app-header">
        <nav>
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/plan">Plan</NavLink>
          <NavLink to="/study">Study</NavLink>
        </nav>
        <SessionBar />
      </header>
      <main>
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

`src/main.tsx` (replace — bootstrap settings before first render):

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ensureSettings } from './data/db';
import './index.css';

void ensureSettings().then(() => {
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Manual smoke check**

Run: `npm run dev` — open the printed URL. Expect header nav with three routes and empty pages.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/main.tsx src/ui
git commit -m "feat(ui): app shell with routing and global session bar"
```

---

### Task 11: Plan page — areas and items management

**Files:**
- Modify: `src/ui/routes/PlanPage.tsx`
- Test: `src/ui/PlanPage.test.tsx`

**Interfaces:**
- Consumes: `listAreas`, `listItemsForArea` (Task 9), `createArea`, `archiveArea` (Task 6), `createItem` (Task 7), `AreaPreset`, `ItemKind` types.
- Produces: the Plan surface — the ONLY place metadata is entered (brief §4).

- [ ] **Step 1: Write the failing test**

`src/ui/PlanPage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanPage } from './routes/PlanPage';
import { db } from '../data/db';
import { resetDb } from '../test/resetDb';

describe('PlanPage', () => {
  beforeEach(resetDb);

  it('creates an area with a preset, then an item inside it', async () => {
    const user = userEvent.setup();
    render(<PlanPage />);

    await user.type(screen.getByLabelText('Area name'), 'Algorithms');
    await user.selectOptions(screen.getByLabelText('Preset'), 'practice');
    await user.click(screen.getByRole('button', { name: 'Add area' }));
    expect(await screen.findByRole('heading', { name: 'Algorithms' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('New item title'), 'Two pointers');
    await user.selectOptions(screen.getByLabelText('Kind'), 'practice');
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    expect(await screen.findByText('Two pointers')).toBeInTheDocument();

    const area = (await db.areas.toArray())[0];
    expect(area.profile.attempts).toBe(true); // practice preset applied
    expect(await db.items.count()).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/PlanPage.test.tsx`
Expected: FAIL — stub page has no form.

- [ ] **Step 3: Implement**

`src/ui/routes/PlanPage.tsx` (replace stub):

```tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listAreas, listItemsForArea } from '../../data/queries';
import { archiveArea, createArea } from '../../services/areas';
import { createItem } from '../../services/items';
import type { Area, AreaPreset, ItemKind } from '../../domain/types';

const PRESETS: AreaPreset[] = ['conceptual', 'practice', 'project', 'time-only', 'minimal'];
const KINDS: ItemKind[] = ['note', 'practice', 'project', 'reading'];

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
    <div className="card">
      <h3>New area</h3>
      <label>
        Area name <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>{' '}
      <label>
        Preset{' '}
        <select value={preset} onChange={(e) => setPreset(e.target.value as AreaPreset)}>
          {PRESETS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </label>{' '}
      <label>
        Weekly target (min) <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} />
      </label>{' '}
      <button onClick={() => void submit()}>Add area</button>
    </div>
  );
}

function AreaSection({ area }: { area: Area }) {
  const items = useLiveQuery(() => listItemsForArea(area.id), [area.id]);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ItemKind>('note');
  const addItem = async () => {
    if (!title.trim()) return;
    await createItem({ areaId: area.id, title: title.trim(), kind });
    setTitle('');
  };
  return (
    <section className="card">
      <h3>{area.name}</h3>
      <p>
        {area.weeklyTargetMinutes ? `Target ${area.weeklyTargetMinutes} min/week · ` : ''}
        <button onClick={() => void archiveArea(area.id)}>Archive</button>
      </p>
      <ul>
        {(items ?? []).map((i) => (
          <li key={i.id}>
            {i.title} <small>({i.kind} · {i.status})</small>
          </li>
        ))}
      </ul>
      <label>
        New item title <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>{' '}
      <label>
        Kind{' '}
        <select value={kind} onChange={(e) => setKind(e.target.value as ItemKind)}>
          {KINDS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </label>{' '}
      <button onClick={() => void addItem()}>Add item</button>
    </section>
  );
}

export function PlanPage() {
  const areas = useLiveQuery(listAreas);
  return (
    <div>
      <h2>Plan</h2>
      <NewAreaForm />
      {(areas ?? []).map((a) => (
        <AreaSection key={a.id} area={a} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/PlanPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/routes/PlanPage.tsx src/ui/PlanPage.test.tsx
git commit -m "feat(ui): Plan surface for areas and items"
```

---

### Task 12: Study page — start/stop, notes, drills, stale recovery

**Files:**
- Modify: `src/ui/routes/StudyPage.tsx`
- Create: `src/ui/components/NoteEditor.tsx`
- Test: `src/ui/StudyPage.test.tsx`

**Interfaces:**
- Consumes: `listAreas`, `listItemsForArea` (Task 9); `startSession`, `getActiveSession`, `getStaleActiveSession`, `trimSessionToLastTick`, `addManualSession` (Task 8); `saveNote`, `getNoteText`, `setDrillDone`, `isDrillDoneToday` (Task 7).
- Produces: the Study surface. **Friction invariant (brief §3): zero required inputs — tested here.**

- [ ] **Step 1: Write the failing test — including the friction invariant**

`src/ui/StudyPage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudyPage } from './routes/StudyPage';
import { createArea } from '../services/areas';
import { createItem } from '../services/items';
import { getActiveSession } from '../services/sessions';
import { resetDb } from '../test/resetDb';

describe('StudyPage', () => {
  beforeEach(resetDb);

  it('FRICTION INVARIANT: the Study route contains no required inputs (brief §3)', async () => {
    const area = await createArea({ name: 'A', preset: 'conceptual' });
    await createItem({ areaId: area.id, title: 'CAP theorem', kind: 'note' });
    const { container } = render(<StudyPage />);
    await screen.findByText('CAP theorem');
    expect(container.querySelectorAll('[required]')).toHaveLength(0);
  });

  it('starts a session from an item with one click and stops without any prompt', async () => {
    const user = userEvent.setup();
    const area = await createArea({ name: 'A', preset: 'conceptual' });
    await createItem({ areaId: area.id, title: 'CAP theorem', kind: 'note' });
    render(<StudyPage />);
    await user.click(await screen.findByRole('button', { name: 'Start' }));
    expect(await getActiveSession()).toBeDefined();
    expect((await getActiveSession())?.itemId).toBeDefined();
  });

  it('minimal-mode areas show a done-tick instead of metadata (UC-5)', async () => {
    const user = userEvent.setup();
    const area = await createArea({ name: 'Drills', preset: 'minimal' });
    await createItem({ areaId: area.id, title: 'Daily kata', kind: 'practice' });
    render(<StudyPage />);
    const checkbox = await screen.findByRole('checkbox', { name: /Daily kata/ });
    await user.click(checkbox);
    await waitFor(() => expect(checkbox).toBeChecked()); // liveQuery re-render is async
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/StudyPage.test.tsx`
Expected: FAIL — stub page renders none of this.

- [ ] **Step 3: Implement NoteEditor**

`src/ui/components/NoteEditor.tsx`:

```tsx
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { getNoteText, saveNote } from '../../services/items';

export function NoteEditor({ itemId }: { itemId: string }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    void getNoteText(itemId).then((t) => {
      setText(t);
      setLoaded(true);
    });
  }, [itemId]);

  if (!loaded) return null;
  return (
    <div className="card">
      <button onClick={() => setPreview((p) => !p)}>{preview ? 'Edit' : 'Preview'}</button>
      {preview ? (
        <ReactMarkdown>{text}</ReactMarkdown>
      ) : (
        <textarea
          className="note"
          aria-label="Notes"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => void saveNote(itemId, text)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implement StudyPage**

`src/ui/routes/StudyPage.tsx` (replace stub):

```tsx
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listAreas, listItemsForArea } from '../../data/queries';
import {
  addManualSession, getActiveSession, getStaleActiveSession,
  startSession, trimSessionToLastTick,
} from '../../services/sessions';
import { isDrillDoneToday, setDrillDone } from '../../services/items';
import type { Area, Item, Session } from '../../domain/types';
import { NoteEditor } from '../components/NoteEditor';

function StaleSessionBanner() {
  const [stale, setStale] = useState<Session | null>(null);
  useEffect(() => {
    void getStaleActiveSession().then(setStale);
  }, []);
  if (!stale) return null;
  return (
    <div className="banner">
      A session from {new Date(stale.startedAt).toLocaleString()} is still running.{' '}
      <button
        onClick={() => {
          void trimSessionToLastTick(stale.id);
          setStale(null);
        }}
      >
        End it at last activity
      </button>{' '}
      <button onClick={() => setStale(null)}>Keep it running</button>
    </div>
  );
}

function DrillRow({ item }: { item: Item }) {
  const done = useLiveQuery(() => isDrillDoneToday(item.id), [item.id]);
  return (
    <li>
      <label>
        <input
          type="checkbox"
          checked={done ?? false}
          onChange={(e) => void setDrillDone(item.id, e.target.checked)}
        />{' '}
        {item.title}
      </label>
    </li>
  );
}

function StudyAreaSection({ area }: { area: Area }) {
  const items = useLiveQuery(() => listItemsForArea(area.id), [area.id]);
  const [minutes, setMinutes] = useState('');
  return (
    <section className="card">
      <h3>{area.name}</h3>
      <ul>
        {(items ?? []).map((item) =>
          area.profile.minimalMode && item.kind === 'practice' ? (
            <DrillRow key={item.id} item={item} />
          ) : (
            <li key={item.id}>
              {item.title}{' '}
              <button onClick={() => void startSession({ itemId: item.id })}>Start</button>
            </li>
          )
        )}
      </ul>
      <details>
        <summary>Log time without the timer</summary>
        <label>
          Minutes <input type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </label>{' '}
        <button
          onClick={() => {
            const n = Number(minutes);
            if (n > 0) void addManualSession({ areaId: area.id, minutes: n });
            setMinutes('');
          }}
        >
          Add
        </button>
      </details>
    </section>
  );
}

export function StudyPage() {
  const areas = useLiveQuery(listAreas);
  const active = useLiveQuery(getActiveSession);
  return (
    <div>
      <h2>Study</h2>
      <StaleSessionBanner />
      {active?.itemId && <NoteEditor itemId={active.itemId} />}
      {(areas ?? []).map((a) => (
        <StudyAreaSection key={a.id} area={a} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/ui/StudyPage.test.tsx`
Expected: PASS (3 tests — including the friction invariant).

- [ ] **Step 6: Commit**

```bash
git add src/ui/routes/StudyPage.tsx src/ui/components/NoteEditor.tsx src/ui/StudyPage.test.tsx
git commit -m "feat(ui): Study surface - one-tap sessions, notes, drills, stale recovery"
```

---

### Task 13: Dashboard — consistency card and backup panel

**Files:**
- Modify: `src/ui/routes/DashboardPage.tsx`
- Create: `src/ui/components/BackupPanel.tsx`
- Test: `src/ui/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `consistencySummary` (Task 9), `exportBackup`, `importBackup` (Task 9), `db.settings`.
- Produces: the Dashboard surface with the consistency metric and always-available export/import (brief §9).

- [ ] **Step 1: Write the failing test**

`src/ui/DashboardPage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardPage } from './routes/DashboardPage';
import { createArea } from '../services/areas';
import { addManualSession } from '../services/sessions';
import { ensureSettings } from '../data/db';
import { resetDb } from '../test/resetDb';

describe('DashboardPage', () => {
  beforeEach(async () => {
    await resetDb();
    await ensureSettings();
  });

  it('shows weekly minutes, streak, and the export control', async () => {
    const area = await createArea({ name: 'A', preset: 'practice', weeklyTargetMinutes: 120 });
    await addManualSession({ areaId: area.id, minutes: 30 });
    render(<DashboardPage />);
    expect(await screen.findByText(/30 \/ 120 min this week/)).toBeInTheDocument();
    expect(screen.getByText(/Streak: 1 day/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export backup' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/DashboardPage.test.tsx`
Expected: FAIL — stub page.

- [ ] **Step 3: Implement BackupPanel**

`src/ui/components/BackupPanel.tsx`:

```tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { exportBackup, importBackup } from '../../services/backupService';

export function BackupPanel() {
  const settings = useLiveQuery(() => db.settings.get('singleton'));
  const [errors, setErrors] = useState<string[]>([]);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    const proceed = window.confirm(
      'Importing replaces ALL current data. A backup of the current data downloads first. Continue?'
    );
    if (!proceed) return;
    const result = await importBackup(await file.text());
    setErrors(result.ok ? [] : result.errors);
  };

  return (
    <section className="card">
      <h3>Backup</h3>
      <p>
        {settings?.lastExportAt
          ? `Last export: ${new Date(settings.lastExportAt).toLocaleString()}`
          : 'Never exported — your data lives only in this browser.'}
      </p>
      <button onClick={() => void exportBackup()}>Export backup</button>{' '}
      <label>
        Import backup{' '}
        <input type="file" accept="application/json" onChange={(e) => void onImport(e.target.files?.[0])} />
      </label>
      {errors.map((e) => (
        <p key={e} className="error">{e}</p>
      ))}
    </section>
  );
}
```

- [ ] **Step 4: Implement DashboardPage**

`src/ui/routes/DashboardPage.tsx` (replace stub):

```tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { consistencySummary } from '../../data/queries';
import { BackupPanel } from '../components/BackupPanel';

export function DashboardPage() {
  const summary = useLiveQuery(() => consistencySummary());
  if (!summary) return null;
  return (
    <div>
      <h2>Dashboard</h2>
      <section className="card">
        <h3>Consistency</h3>
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
      </section>
      <BackupPanel />
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/ui/DashboardPage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/routes/DashboardPage.tsx src/ui/components/BackupPanel.tsx src/ui/DashboardPage.test.tsx
git commit -m "feat(ui): dashboard with consistency metrics and backup panel"
```

---

### Task 14: Wrap-up — full suite, build, README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: everything.
- Produces: a verified, documented phase-1 app.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — every test from Tasks 2–13 green.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors.

- [ ] **Step 3: Manual end-to-end walkthrough** (`npm run dev`)

1. Plan: create area "Algorithms" (practice preset, 120 min target) + item "Two pointers"; create area "Drills" (minimal preset) + item "Daily kata".
2. Study: Start on "Two pointers" → session bar appears; write a note; Stop — verify **no dialog appears**.
3. Study: tick "Daily kata" done.
4. Dashboard: minutes and streak reflect the above.
5. Export backup → file downloads. Create a junk area. Import the file → junk gone, safety backup downloaded first.

- [ ] **Step 4: Update README**

Replace `README.md` content with:

```markdown
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
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: README quickstart for phase 1"
```

---

## Self-Review (run after writing, before execution)

1. **Spec coverage** — Phase 1 scope from `docs/implementation-plan.md`: four-layer structure (T1), schema v1 all tables (T5), migration harness = Dexie versioned schema (T5) with real migrations arriving at the first v2 schema change, areas + presets (T6, T11), items all four kinds + markdown artifact (T7, T11, T12), session engine incl. manual + stale recovery (T8, T12), consistency metric + minimal dashboard (T3, T9, T13), export/import + auto-backup + lastExportAt (T4, T9, T13), UC-5 done-tick = `Attempt{pass}` (T7, T12). Both §10 litmus tests are encoded as tests (T12 friction invariant; genericity holds — no per-area code paths anywhere).
2. **Placeholder scan** — no TBDs; every step has full code or an exact command with expected output.
3. **Type consistency** — names used across tasks match their defining task: `getActiveSession`/`startSession`/`stopSession`/`tickSession`/`addManualSession`/`getStaleActiveSession`/`trimSessionToLastTick` (T8); `createItem`/`touchItem`/`saveNote`/`getNoteText`/`setDrillDone`/`isDrillDoneToday` (T7); `listAreas`/`listItemsForArea`/`consistencySummary` (T9); `TABLE_NAMES` = Dexie table names (T4/T5).

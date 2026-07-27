import { describe, it, expect, beforeEach } from 'vitest';
import { consistencySummary, listAreas, coverageSummary, currentWeekPlan, inboxCaptures, dueItems, focusItems, retentionSummary } from './queries';
import { createArea, archiveArea } from '../services/areas';
import { createItem, setDrillDone, setItemStatus } from '../services/items';
import { addManualSession } from '../services/sessions';
import { captureNow, dismissCapture } from '../services/captures';
import { getOrCreateWeekPlan, updateWeekPlanEntry } from '../services/weekPlan';
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
});

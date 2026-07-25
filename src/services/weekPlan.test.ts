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

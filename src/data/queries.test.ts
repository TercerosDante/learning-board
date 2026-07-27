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

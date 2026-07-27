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

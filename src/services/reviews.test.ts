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

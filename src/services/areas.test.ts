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

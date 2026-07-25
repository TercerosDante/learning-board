import { describe, it, expect, beforeEach } from 'vitest';
import { createArea } from './areas';
import { createItem, touchItem, saveNote, getNoteText, setDrillDone, isDrillDoneToday, setItemStatus, updateItem } from './items';
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
});

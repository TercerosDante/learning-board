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

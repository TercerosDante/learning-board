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

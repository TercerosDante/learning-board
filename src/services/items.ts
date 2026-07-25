import { db } from '../data/db';
import { dayKey } from '../domain/time';
import type { Item, ItemKind, ItemStatus } from '../domain/types';

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

export async function setItemStatus(id: string, status: ItemStatus, now = new Date()): Promise<void> {
  await db.items.update(id, { status, updatedAt: now.toISOString() });
}

export async function updateItem(
  id: string,
  patch: Partial<Pick<Item, 'title' | 'estimateMinutes' | 'topicId' | 'tags' | 'keyIdea'>>,
  now = new Date()
): Promise<void> {
  await db.items.update(id, { ...patch, updatedAt: now.toISOString() });
}

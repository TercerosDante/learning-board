import { db } from '../data/db';
import { minutesBetween } from '../domain/time';
import type { Session } from '../domain/types';
import { touchItem } from './items';

export const STALE_GAP_MINUTES = 10;

export async function getActiveSession(): Promise<Session | undefined> {
  return db.sessions.filter((s) => s.endedAt === null).first();
}

export async function startSession(
  target: { areaId?: string; itemId?: string },
  now = new Date()
): Promise<Session> {
  await stopSession(now); // switching is frictionless: no need to stop first
  let areaId = target.areaId;
  if (target.itemId) {
    const item = await db.items.get(target.itemId);
    if (!item) throw new Error(`item ${target.itemId} not found`);
    areaId = item.areaId;
    await touchItem(item.id, now);
  }
  const iso = now.toISOString();
  const session: Session = {
    id: crypto.randomUUID(),
    areaId,
    itemId: target.itemId,
    startedAt: iso,
    endedAt: null,
    lastTickAt: iso,
    source: 'timer',
    createdAt: iso,
    updatedAt: iso,
  };
  await db.sessions.add(session);
  return session;
}

export async function stopSession(now = new Date()): Promise<void> {
  const active = await getActiveSession();
  if (!active) return;
  const iso = now.toISOString();
  await db.sessions.update(active.id, { endedAt: iso, lastTickAt: iso, updatedAt: iso });
}

export async function tickSession(now = new Date()): Promise<void> {
  const active = await getActiveSession();
  if (!active) return;
  await db.sessions.update(active.id, { lastTickAt: now.toISOString() });
}

export async function addManualSession(
  input: { areaId?: string; itemId?: string; minutes: number; note?: string },
  now = new Date()
): Promise<Session> {
  const iso = now.toISOString();
  const startedAt = new Date(now.getTime() - input.minutes * 60000).toISOString();
  const session: Session = {
    id: crypto.randomUUID(),
    areaId: input.areaId,
    itemId: input.itemId,
    startedAt,
    endedAt: iso,
    lastTickAt: iso,
    source: 'manual',
    note: input.note,
    createdAt: iso,
    updatedAt: iso,
  };
  await db.sessions.add(session);
  if (input.itemId) await touchItem(input.itemId, now);
  return session;
}

export async function getStaleActiveSession(now = new Date()): Promise<Session | null> {
  const active = await getActiveSession();
  if (!active) return null;
  return minutesBetween(active.lastTickAt, now.toISOString()) > STALE_GAP_MINUTES ? active : null;
}

export async function trimSessionToLastTick(id: string, now = new Date()): Promise<void> {
  const s = await db.sessions.get(id);
  if (!s || s.endedAt !== null) return;
  await db.sessions.update(id, { endedAt: s.lastTickAt, edited: true, updatedAt: now.toISOString() });
}

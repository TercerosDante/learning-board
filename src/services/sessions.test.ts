import { describe, it, expect, beforeEach } from 'vitest';
import { createArea } from './areas';
import { createItem } from './items';
import {
  getActiveSession, startSession, stopSession, tickSession,
  addManualSession, getStaleActiveSession, trimSessionToLastTick,
} from './sessions';
import { db } from '../data/db';
import { resetDb } from '../test/resetDb';

describe('sessions service', () => {
  beforeEach(resetDb);

  it('startSession from an item resolves areaId and touches the item', async () => {
    const area = await createArea({ name: 'A', preset: 'practice' });
    const item = await createItem({ areaId: area.id, title: 'I', kind: 'practice' });
    const s = await startSession({ itemId: item.id });
    expect(s.areaId).toBe(area.id);
    expect(s.endedAt).toBeNull();
    expect((await db.items.get(item.id))?.status).toBe('in-progress');
    expect((await getActiveSession())?.id).toBe(s.id);
  });

  it('starting a new session auto-stops the previous one (never two active)', async () => {
    const area = await createArea({ name: 'A', preset: 'conceptual' });
    const s1 = await startSession({ areaId: area.id }, new Date(2026, 6, 24, 10, 0));
    const s2 = await startSession({ areaId: area.id }, new Date(2026, 6, 24, 10, 30));
    expect((await db.sessions.get(s1.id))?.endedAt).not.toBeNull();
    expect((await getActiveSession())?.id).toBe(s2.id);
    await stopSession(new Date(2026, 6, 24, 11, 0));
    expect(await getActiveSession()).toBeUndefined();
  });

  it('manual sessions are backdated by duration and never active', async () => {
    const area = await createArea({ name: 'A', preset: 'time-only' });
    const now = new Date(2026, 6, 24, 22, 0);
    const s = await addManualSession({ areaId: area.id, minutes: 40 }, now);
    expect(s.source).toBe('manual');
    expect(s.endedAt).toBe(now.toISOString());
    expect(new Date(s.startedAt).getTime()).toBe(now.getTime() - 40 * 60000);
    expect(await getActiveSession()).toBeUndefined();
  });

  it('stale detection and one-tap trim (open-decisions.md D-4)', async () => {
    const area = await createArea({ name: 'A', preset: 'conceptual' });
    const s = await startSession({ areaId: area.id }, new Date(2026, 6, 24, 10, 0));
    await tickSession(new Date(2026, 6, 24, 10, 5));
    expect(await getStaleActiveSession(new Date(2026, 6, 24, 10, 12))).toBeNull(); // 7 min gap: fine
    const stale = await getStaleActiveSession(new Date(2026, 6, 24, 11, 0)); // 55 min gap
    expect(stale?.id).toBe(s.id);
    await trimSessionToLastTick(s.id);
    const trimmed = await db.sessions.get(s.id);
    expect(trimmed?.endedAt).toBe(new Date(2026, 6, 24, 10, 5).toISOString());
    expect(trimmed?.edited).toBe(true);
  });
});
